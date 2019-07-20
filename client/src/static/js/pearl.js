const API_URL = process.env.API_URL

// var traceView = require('./traceView');

const resultLink = document.getElementById('link-results')

const submitButton = document.getElementById('btn-submit')
submitButton.addEventListener('click', showUpload)
const exampleButton = document.getElementById('btn-example')
exampleButton.addEventListener('click', showExample)
const saveButton = document.getElementById('btn-save-Json')
saveButton.addEventListener('click', saveJsonFile)
const saveUserButton = document.getElementById('btn-save-Fasta')
saveUserButton.addEventListener('click', saveFastaFile)
const loadJFile = document.getElementById('inputJsonFile')
loadJFile.addEventListener('change', loadJsonFile, false);

const inputFiles = document.getElementById('inputFiles')
const referenceFile = document.getElementById('referenceFile')
const resultInfo = document.getElementById('result-info')
const resultError = document.getElementById('result-error')
const resultData = document.getElementById('result-data')

window.data = ""

$('#mainTab a').on('click', function(e) {
  e.preventDefault()
  $(this).tab('show')
})

function showElement(element) {
  element.classList.remove('d-none')
}

function hideElement(element) {
  element.classList.add('d-none')
}

function showExample() {
  run("example")
}

function showUpload() {
  run("data")
}

// TODO client-side validation
function run(stat) {
  window.data = ""
  resultLink.click()
  const formData = new FormData()
  if (stat == "example") {
    formData.append('showExample', 'showExample')
  } else {
    formData.append('queryFilesCount', inputFiles.files.length)
    for (var i = 0 ; i < inputFiles.files.length ; i++) {
        formData.append('queryFile_' + i, inputFiles.files[i])
    }
    formData.append('referenceFile', referenceFile.files[0])
  }
  
  resultData.innerHTML = ""
  hideElement(resultError)
  showElement(resultInfo)

  axios
    .post(`${API_URL}/upload`, formData)
    .then(res => {
	if (res.status === 200) {
	      window.data = res.data.data
          handleSuccess()
      }
    })
    .catch(err => {
      let errorMessage = err
      if (err.response) {
        errorMessage = err.response.data.errors
          .map(error => error.title)
          .join('; ')
      }
      hideElement(resultInfo)
      showElement(resultError)
      resultError.querySelector('#error-message').textContent = errorMessage
    })
}

function handleSuccess() {
    // Create a user edited sequence from reference or consensus
    if ((window.data.hasOwnProperty("msa")) && (window.data.msa.length > 0)) {
        for (var i = 0 ; i < window.data.msa.length ; i++) {
            if ((window.data.msa[i].hasOwnProperty("reference")) &&
                (window.data.msa[i].reference == true) &&
                (window.data.msa[i].hasOwnProperty("align"))) {
                window.data["userEditedSequence"] = (' ' + window.data.msa[i].align).slice(1);
                window.data.gappedReference = (' ' + window.data.msa[i].align).slice(1);
            }
        }
        if ((!(window.data.hasOwnProperty("userEditedSequence"))) &&
            (window.data.hasOwnProperty("gappedConsensus"))) {
            window.data["userEditedSequence"] = window.data.gappedConsensus
        }
    }
    // Create a control sequence for color coding and finding points of interest
    //   N - no information, only reference data available
    //   G - good, all traces agree on same base
    //   C - conflict, some traces suggest other bases
    //   M - mismatch, traces agree on different base then reference
    //   E - edited, the base was entered manually by the user
    var secAsConf = document.getElementById('secPeakAsConf').checked
    if ((window.data.hasOwnProperty("msa")) && (window.data.msa.length > 0) &&
        (window.data.hasOwnProperty("gappedTraces")) && (window.data.gappedTraces.length > 0) &&
        (window.data.hasOwnProperty("userEditedSequence")) &&
        (window.data.hasOwnProperty("gappedConsensus"))) {
        var colSeq = ""
        for (var i = 0; i < window.data.userEditedSequence.length ; i++) {
            var baseCode = "n" // n - not set
            var baseCons = "0"
            for (var k = 0 ; k < window.data.msa.length ; k++) {
                 if ((window.data.msa[k].reference == false) &&
                     (parseInt(window.data.msa[k].leadingGaps) < i) &&
                     (parseInt(window.data.msa[k].leadingGaps) + window.data.msa[k].align.length > i)) {
                     var base = window.data.msa[k].align.charAt(i - parseInt(window.data.msa[k].leadingGaps))
                     if (baseCode == "n") {
                         baseCode = "G"  // G - good
                         baseCons = base
                     }
                     if (baseCons != base) {
                         baseCode = "C"  // C - conflict
                     }
                     if (secAsConf == true) {
                         var pos = i - parseInt(window.data.gappedTraces[k].leadingGaps);
                         var secStr = window.data.gappedTraces[k].basecalls[window.data.gappedTraces[k].basecallPos[pos]]
                         if (secStr.includes("|")) {
                             baseCode = "C"  // C - conflict
                         }
                     }
                 }
            }
            if ((baseCode == "G") || (baseCode == "C")) {
                if (base == window.data.userEditedSequence.charAt(i)) {
                    colSeq += baseCode
                } else {
                    if (baseCode == "G") {
                        colSeq += "M"  // M - mismatch
                    } else {
                        colSeq += "C"  // C - conflict
                    }
                }
            } else {
                colSeq += "N"  // N - no information
            }
        }
        window.data.controlSequence = colSeq
    }

    // Focus on Position
    window.data["editPosition"] = 0

    // Create the trace parameters
    window.data["tp"] = {}
    window.data.tp["winXst"] = 0;
    window.data.tp["winXend"] = 600;
    window.data.tp["winYend"] = 2300;
    window.data.tp["frameXst"] = 0;
    window.data.tp["frameXend"] = 1000;
    window.data.tp["frameYst"] = 0;
    window.data.tp["frameYend"] = 200;
    window.data.tp["baseCol"] = [["green",1.5],["blue",1.5],["black",1.5],["red",1.5]];
    window.data.tp["svgHeight"] = 30;

    // Cleanup Window stuff
    hideElement(resultInfo)
    hideElement(resultError)

    goNextConflict()
}

window.goNextConflict = goNextConflict;
function goNextConflict() {
    // Find first mismatches
    if (window.data.hasOwnProperty("controlSequence")) {
        for (var i = 0; i <  window.data.controlSequence.length - 1; i++) {
            var pos = window.data.editPosition + 1 + i;
            if (pos > window.data.controlSequence.length - 1) {
                pos -= window.data.controlSequence.length;
            }
            if (window.data.controlSequence.charAt(pos) == "M") {
                window.data.editPosition = pos;
                repaintData();
                return;
            }
        }
        for (var i = 0; i <  window.data.controlSequence.length - 1; i++) {
            var pos = window.data.editPosition + 1 + i;
            if (pos > window.data.controlSequence.length - 1) {
                pos -= window.data.controlSequence.length;
            }
            if (window.data.controlSequence.charAt(pos) == "C") {
                window.data.editPosition = pos;
                repaintData();
                return;
            }
        }
        for (var i = 0; i <  window.data.controlSequence.length - 1; i++) {
            var pos = window.data.editPosition + 1 + i;
            if (pos > window.data.controlSequence.length - 1) {
                pos -= window.data.controlSequence.length;
            }
            if (window.data.controlSequence.charAt(pos) == "E") {
                window.data.editPosition = pos;
                repaintData();
                return;
            }
        }
    }
    repaintData();
}

//
function repaintData() {
    var retHtml = ""
    var startZeroOne = 0
    var outSeq = "\n"
    var seq = window.data.userEditedSequence
    var contr = window.data.controlSequence
    var digits = 0;
    var lastBaseMark = ".";
    var openMark = "";
    var closeMark = "";

    for (var i = seq.length; i > 1 ; i = i / 10) {
        digits++;
    }
    digits++;

    for (var i = 0; i < seq.length ; i++) {
        if (i % 100 == 0) {
            if (i != 0) {
                outSeq += closeMark + "\n";
            }
            var pIco = i + startZeroOne;
            var iStr = pIco.toString();
            for (var j = digits; j > iStr.length ; j--) {
                outSeq += " ";
            }
            outSeq += iStr + "  " + openMark;
         } else {
            if (i % 10 == 0) {
                outSeq += " ";
            }
        }
        // Place the color coding
        //   N - no information, only reference data available
        //   G - good, all traces agree on same base
        //   C - conflict, some traces suggest other bases
        //   M - mismatch, traces agree on different base then reference
        //   E - edited, the base was entered manually by the user

        if (contr.charAt(i) != lastBaseMark) {
            if (contr.charAt(i) == "N") {
                openMark = '<a style="background-color:#F2F2F2">'; // grey
                closeMark = "</a>";
            }
            if (contr.charAt(i) == "G") {
                openMark = '<a style="background-color:#CCFFCC">'; // green
                closeMark = "</a>";
            }
            if (contr.charAt(i) == "C") {
                openMark = '<a style="background-color:#FF9900">'; // orange
                closeMark = "</a>";
            }
            if (contr.charAt(i) == "M") {
                openMark = '<a style="background-color:#FF0000">'; // red
                closeMark = "</a>";
            }
            if (contr.charAt(i) == "E") {
                openMark = '<a style="background-color:#00B300">'; // green
                closeMark = "</a>";
            }
            lastBaseMark = contr.charAt(i);
            outSeq += closeMark + openMark;
        }
        if (window.data.editPosition == i) {
            outSeq += "<strong>" + seq.charAt(i) + "</strong>";
        } else {
            outSeq += seq.charAt(i);
        }
    }
    retHtml = '<pre id="align-overview" onclick="selectSeqPos()"> ' + outSeq + closeMark + "\n</pre>";
    retHtml += '  <div class="form-group">\n';
    retHtml += '    <label for="position-field">Position:</label>\n';
    retHtml += '    <input type="text" class="form-control" id="position-field" ';
    retHtml += 'onChange="setFieldPosition();" value="' + window.data.editPosition + '">\n<br />\n';
    retHtml += '    <button type="button" class="btn btn-success" onClick="decideBase(\'A\')">\n';
    retHtml += '      <i class="fas fa-gavel" style="margin-right: 5px;"></i>\n';
    retHtml += '      Set A\n';
    retHtml += '    </button>\n';
    retHtml += '    <button type="button" class="btn btn-primary" onClick="decideBase(\'C\')">\n';
    retHtml += '      <i class="fas fa-gavel" style="margin-right: 5px;"></i>\n';
    retHtml += '      Set C\n';
    retHtml += '    </button>\n';
    retHtml += '    <button type="button" class="btn btn-dark" onClick="decideBase(\'G\')">\n';
    retHtml += '      <i class="fas fa-gavel" style="margin-right: 5px;"></i>\n';
    retHtml += '      Set G\n';
    retHtml += '    </button>\n';
    retHtml += '    <button type="button" class="btn btn-danger" onClick="decideBase(\'T\')">\n';
    retHtml += '      <i class="fas fa-gavel" style="margin-right: 5px;"></i>\n';
    retHtml += '      Set T\n';
    retHtml += '    </button>\n';
    retHtml += '    <button type="button" class="btn btn-warning" onClick="decideBase(\'N\')">\n';
    retHtml += '      <i class="fas fa-gavel" style="margin-right: 5px;"></i>\n';
    retHtml += '      Set N\n';
    retHtml += '    </button>\n';
    retHtml += '    <button type="button" class="btn btn-secondary" onClick="decideBase(\'-\')">\n';
    retHtml += '      <i class="fas fa-gavel" style="margin-right: 5px;"></i>\n';
    retHtml += '      Set -\n';
    retHtml += '    </button>\n';
    retHtml += '    <a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</a>';
    retHtml += '    <button type="button" class="btn btn-info" onClick="treatNotSequenced()">\n';
    retHtml += '      <i class="fas fa-gavel" style="margin-right: 5px;"></i>\n';
    retHtml += '      Treat as not sequenced\n';
    retHtml += '    </button>\n';
    retHtml += '    <a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</a>';
    retHtml += '    <button type="button" class="btn btn-outline-secondary" onClick="goNextConflict()">\n';
    retHtml += '      Jump to next conflict\n';
    retHtml += '    </button>\n';
    retHtml += '  </div><br />\n';

    // Buttons for trace navigation
    retHtml += '<div id="traceView-Buttons">';
    retHtml += '  <button type="button" id="traceView-nav-bw-step" class="btn btn-outline-secondary" onClick="navBwStep()">&lt;&lt;</button>';
    retHtml += '  <button type="button" id="traceView-nav-bw-bit" class="btn btn-outline-secondary" onClick="navBwOne()">&lt;</button>';
    retHtml += '  <button type="button" id="traceView-nav-zy-in" class="btn btn-outline-secondary" onClick="navZoomYin()">Bigger Peaks</button>';
    retHtml += '  <button type="button" id="traceView-nav-zy-out" class="btn btn-outline-secondary" onClick="navZoomYout()">Smaller Peaks</button>';
    retHtml += '  <button type="button" id="traceView-nav-zx-in" class="btn btn-outline-secondary" onClick="navZoomXin()">Zoom in</button>';
    retHtml += '  <button type="button" id="traceView-nav-zx-out" class="btn btn-outline-secondary" onClick="navZoomXout()">Zoom Out</button>';
    retHtml += '  <button type="button" id="traceView-nav-fw-bit" class="btn btn-outline-secondary" onClick="navFwOne()">&gt;</button>';
    retHtml += '  <button type="button" id="traceView-nav-fw-step" class="btn btn-outline-secondary" onClick="navFwStep()">&gt;&gt;</button>';
    retHtml += '  <a>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</a>';
    retHtml += '  <button type="button" id="traceView-nav-hi-a" class="btn btn-outline-secondary" onClick="navHiA()"><strong>A</strong></button>';
    retHtml += '  <button type="button" id="traceView-nav-hi-c" class="btn btn-outline-secondary" onClick="navHiC()"><strong>C</strong></button>';
    retHtml += '  <button type="button" id="traceView-nav-hi-g" class="btn btn-outline-secondary" onClick="navHiG()"><strong>G</strong></button>';
    retHtml += '  <button type="button" id="traceView-nav-hi-t" class="btn btn-outline-secondary" onClick="navHiT()"><strong>T</strong></button>';
    retHtml += '  <button type="button" id="traceView-nav-hi-n" class="btn btn-outline-secondary" onClick="navHiN()">ACGT</button>';
    retHtml += '</div>';
    retHtml += '<div id="traceView-Traces"></div>';

    resultData.innerHTML = retHtml
    SVGRepaint()
}

window.decideBase = decideBase;
function decideBase(base) {
    window.data.userEditedSequence = window.data.userEditedSequence.substr(0, window.data.editPosition) + base + window.data.userEditedSequence.substr(window.data.editPosition + 1);
    window.data.controlSequence = window.data.controlSequence.substr(0, window.data.editPosition) + "E" + window.data.controlSequence.substr(window.data.editPosition + 1);
    repaintData();
}

window.treatNotSequenced = treatNotSequenced;
function treatNotSequenced() {
    window.data.controlSequence = window.data.controlSequence.substr(0, window.data.editPosition) + "N" + window.data.controlSequence.substr(window.data.editPosition + 1);
    repaintData();
}

window.setFieldPosition = setFieldPosition;
function setFieldPosition() {
    window.data.editPosition = parseInt(document.getElementById('position-field').value)
    repaintData();
}

window.selectSeqPos = selectSeqPos;
function selectSeqPos() {
    var preText = document.getElementById('align-overview')
    var sel, range;
    sel = window.getSelection();
    if (sel.rangeCount) {
        range = sel.getRangeAt(0);
        var tempRange = document.createRange();
        tempRange.selectNodeContents(preText);
        tempRange.setEnd(range.startContainer, range.startOffset);
        var beforeText = tempRange.toString();
        beforeText = beforeText.replace(/<span style="background-color:*[^" ]+">/ig, "");
        beforeText = beforeText.replace(/<\/span>/g, "");
        beforeText = beforeText.replace(/<a [^>]+>/ig, "");
        beforeText = beforeText.replace(/<\/a>/g, "");
        beforeText = beforeText.replace(/<br[ \/]*>/g, "");
        beforeText = beforeText.replace(/<strong>/ig, "");
        beforeText = beforeText.replace(/<\/strong>/ig, "");
        beforeText = beforeText.replace(/\d/ig, "");
        beforeText = beforeText.replace(/[ \n\t\r]/ig, "");
        window.data.editPosition = beforeText.length;
        repaintData();
    }
}

window.saveDebugFile = saveDebugFile;
function saveDebugFile(txt) {
    var content = txt;
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    var blob = new Blob([content], {type: "text/plain"});
    var browser = detectBrowser();
    if (browser != "edge") {
	    var url = window.URL.createObjectURL(blob);
	    a.href = url;
	    a.download = "debug.txt";
	    a.click();
	    window.URL.revokeObjectURL(url);
    } else {
        window.navigator.msSaveBlob(blob, fileName);
    }
    return;
};

window.detectBrowser = detectBrowser;
function detectBrowser() {
    var browser = window.navigator.userAgent.toLowerCase();
    if (browser.indexOf("edge") != -1) {
        return "edge";
    }
    if (browser.indexOf("firefox") != -1) {
        return "firefox";
    }
    if (browser.indexOf("chrome") != -1) {
        return "chrome";
    }
    if (browser.indexOf("safari") != -1) {
        return "safari";
    }
    alert("Unknown Browser: Functionality may be impaired!\n\n" + browser);
    return browser;
}

window.saveJsonFile = saveJsonFile;
function saveJsonFile() {
    if (window.data == "") {
        return;
    }
    var content = JSON.stringify(window.data);
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    var blob = new Blob([content], {type: "application/json"});
    var browser = detectBrowser();
    if (browser != "edge") {
	    var url = window.URL.createObjectURL(blob);
	    a.href = url;
	    a.download = "multipleAlignment.json";
	    a.click();
	    window.URL.revokeObjectURL(url);
    } else {
        window.navigator.msSaveBlob(blob, fileName);
    }
    return;
};

window.saveFastaFile = saveFastaFile;
function saveFastaFile() {
    if (window.data == "") {
        return;
    }
    var content = ">user sequence\n" + window.data.userEditedSequence.replace(/-/g, "");
    var a = document.createElement("a");
    document.body.appendChild(a);
    a.style.display = "none";
    var blob = new Blob([content], {type: "text/plain"});
    var browser = detectBrowser();
    if (browser != "edge") {
	    var url = window.URL.createObjectURL(blob);
	    a.href = url;
	    a.download = "user_sequence.fa";
	    a.click();
	    window.URL.revokeObjectURL(url);
    } else {
        window.navigator.msSaveBlob(blob, fileName);
    }
    return;
};

window.loadJsonFile = loadJsonFile;
function loadJsonFile(f){
    var file = f.target.files[0];
    if (file) { // && file.type.match("text/*")) {
        var reader = new FileReader();
        reader.onload = function(event) {
            window.data = JSON.parse(event.target.result);
            repaintData();
        }
        reader.readAsText(file);
    } else {
        alert("Error opening file");
    }
}


// The trace functions
window.navFaintCol = navFaintCol;
function navFaintCol() {
    window.data.tp.baseCol = [["#a6d3a6",1.5],["#a6a6ff",1.5],["#a6a6a6",1.5],["#ffa6a6",1.5]];
}

window.navHiN = navHiN;
function navHiN() {
    window.data.tp.baseCol = [["green",1.5],["blue",1.5],["black",1.5],["red",1.5]];
    SVGRepaint();
}

window.navHiA = navHiA;
function navHiA() {
    navFaintCol();
    window.data.tp.baseCol[0] = ["green",2.5];
    SVGRepaint();
}

window.navHiC = navHiC;
function navHiC() {
    navFaintCol();
    window.data.tp.baseCol[1] = ["blue",2.5];
    SVGRepaint();
}

window.navHiG = navHiG;
function navHiG() {
    navFaintCol();
    window.data.tp.baseCol[2] = ["black",2.5];
    SVGRepaint();
}

window.navHiT = navHiT;
function navHiT() {
    navFaintCol();
    window.data.tp.baseCol[3] = ["red",2.5];
    SVGRepaint();
}

window.navZoomYin = navZoomYin;
function navZoomYin() {
    window.data.tp.winYend = window.data.tp.winYend * 3 / 4;
    SVGRepaint();
}

window.navZoomYout = navZoomYout;
function navZoomYout() {
    window.data.tp.winYend = window.data.tp.winYend * 4 / 3;
    SVGRepaint();
}

window.navZoomXin = navZoomXin;
function navZoomXin() {
    var oldStep = window.data.tp.winXend - window.data.tp.winXst;
    var center = window.data.tp.winXst + oldStep / 2;
    var step = Math.floor(oldStep * 3 / 4);
    window.data.tp.winXst = Math.floor(center - step / 2);
    window.data.tp.winXend = Math.floor(center + step / 2);
    SVGRepaint();
}

window.navZoomXout = navZoomXout;
function navZoomXout() {
    var oldStep = window.data.tp.winXend - window.data.tp.winXst;
    var center = window.data.tp.winXst + oldStep / 2;
    var step = Math.floor(oldStep * 4 / 3);
    window.data.tp.winXst = Math.floor(center - step / 2);
    window.data.tp.winXend = Math.floor(center + step / 2);
    if (window.data.tp.winXst < 0) {
        window.data.tp.winXst = 0;
        window.data.tp.winXend = step;
    }
    SVGRepaint();
}

window.navBwStep = navBwStep;
function navBwStep(){
    window.data.editPosition -= 30;
    if (window.data.editPosition < 0) {
        window.data.editPosition = window.data.userEditedSequence.length - 1;
    }
    repaintData();
}

window.navBwOne = navBwOne;
function navBwOne(){
    window.data.editPosition -= 1;
    if (window.data.editPosition < 0) {
        window.data.editPosition = window.data.userEditedSequence.length - 1;
    }
    repaintData();
}

window.navFwOne = navFwOne;
function navFwOne(){
    window.data.editPosition += 1;
    if (window.data.editPosition > window.data.userEditedSequence.length - 1) {
        window.data.editPosition = 0;
    }
    repaintData();
}

window.navFwStep = navFwStep;
function navFwStep(){
    window.data.editPosition += 30;
    if (window.data.editPosition > window.data.userEditedSequence.length - 1) {
        window.data.editPosition = 0;
    }
    repaintData();
}

window.SVGRepaint = SVGRepaint;
function SVGRepaint(){
    var retVal = createSVG();
    showSVG(retVal);
}

function showSVG(svg) {
    var retVal = svg;
    var regEx1 = /</g;
    retVal = retVal.replace(regEx1, "%3C");
    var regEx2 = />/g;
    retVal = retVal.replace(regEx2, "%3E");
    var regEx3 = /#/g;
    retVal = retVal.replace(regEx3, "%23");
    retVal = '<img src="data:image/svg+xml,' + retVal + '" alt="Trace-SVG">';
    var sectionResults = document.getElementById('traceView-Traces')
    sectionResults.innerHTML = retVal;
}

function createSVG() {
    var retVal = createBasics();
    // Only paint traces with information
    var count = 0;
      //  for (var i = 0; i < window.data.userEditedSequence.length ; i++) {
    for (var k = 0 ; k < window.data.gappedTraces.length ; k++) {
         if ((parseInt(window.data.gappedTraces[k].leadingGaps) < window.data.editPosition) &&
             (parseInt(window.data.gappedTraces[k].leadingGaps) + window.data.gappedTraces[k].basecallPos.length > window.data.editPosition)) {
             retVal += createAllCalls(count,k);
             retVal += createCoodinates(count,k);
             count++;
         }
    }

    retVal += "</svg>";
    var head =  "<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='" + window.data.tp.svgHeight
    head += "' viewBox='-60 -40 1200 " + window.data.tp.svgHeight + "'>";
    return head + retVal;
}

function createBasics (){
    var sqrY = -20;
    var txtY = -9;
    var retVal = "<rect x='400' y='" + sqrY + "' width='10' height='10' style='fill:green;stroke-width:3;stroke:green' />";
    retVal += "<text x='417' y='" + txtY + "' font-family='Arial' font-size='18' fill='black'>A</text>";
    retVal += "<rect x='450' y='" + sqrY + "' width='10' height='10' style='fill:blue;stroke-width:3;stroke:blue' />";
    retVal += "<text x='467' y='" + txtY + "' font-family='Arial' font-size='18' fill='black'>C</text>";
    retVal += "<rect x='500' y='" + sqrY + "' width='10' height='10' style='fill:black;stroke-width:3;stroke:black' />";
    retVal += "<text x='517' y='" + txtY + "' font-family='Arial' font-size='18' fill='black'>G</text>";
    retVal += "<rect x='550' y='" + sqrY + "' width='10' height='10' style='fill:red;stroke-width:3;stroke:red' />";
    retVal += "<text x='567' y='" + txtY + "' font-family='Arial' font-size='18' fill='black'>T</text>";

    return retVal;
}

function createCoodinates (nr, arrPos){
    var yShift = 370 * nr + 30
    window.data.tp.svgHeight += 370
    var focusTr = window.data.gappedTraces[arrPos].basecallPos[window.data.editPosition - parseInt(window.data.gappedTraces[arrPos].leadingGaps)]

    var lineXst = window.data.tp.frameXst - 5;
    var lineXcent = window.data.tp.frameXst + parseInt((window.data.tp.frameXend - window.data.tp.frameXst) / 2);
    var lineXend = window.data.tp.frameXend + 5;
    var lineYst = yShift + window.data.tp.frameYst - 5;
    var lineYend = yShift + window.data.tp.frameYend + 5;
    var retVal = "<line x1='" + lineXst + "' y1='" + lineYst;
    retVal += "' x2='" + lineXst + "' y2='" + lineYend + "' stroke-width='2' stroke='black' stroke-linecap='square'/>";
    retVal += "<line x1='" + lineXcent + "' y1='" + lineYst;
    retVal += "' x2='" + lineXcent + "' y2='" + lineYend + "' stroke-width='2' stroke='#cccccc' stroke-linecap='square'/>";
    retVal += "<line x1='" + lineXst + "' y1='" + lineYend;
    retVal += "' x2='" + lineXend + "' y2='" + lineYend + "' stroke-width='2' stroke='black' stroke-linecap='square'/>";
    retVal += "<text x='" + (lineXst - 10) + "' y='" + (lineYst - 10);
    retVal += "' font-family='Arial' font-size='18' fill='black' text-anchor='start'>";
    var sampleName = window.data.gappedTraces[arrPos].traceFileName;
    sampleName = sampleName.replace(/pearl_[^_]+_/g, "");
    if(window.data.msa[arrPos].hasOwnProperty('forward')){
        if(window.data.msa[arrPos].forward == true) {
            sampleName += " - forward";
        } else {
            sampleName += " - reverse";
        }
    }
    retVal += sampleName;
    retVal +=  "</text>";

    // The X-Axis
    var startX = focusTr - parseInt((window.data.tp.winXend - window.data.tp.winXst) / 2);
    var endX = focusTr + parseInt((window.data.tp.winXend - window.data.tp.winXst) / 2);
    retVal += "<text x='-60' y='" + (lineYend + 71);
    retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='start'>User Seq</text>";
    if(window.data.hasOwnProperty('gappedReference')){
        retVal += "<text x='-60' y='" + (lineYend + 91);
        retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='start'>Reference</text>";
        retVal += "<text x='-60' y='" + (lineYend + 111);
        retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='start'>Consensus</text>";
    } else {
        retVal += "<text x='-60' y='" + (lineYend + 91);
        retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='start'>Consensus</text>";
    }
    for (var i = 0; i < window.data.gappedTraces[arrPos].basecallPos.length; i++) {
        if ((parseFloat(window.data.gappedTraces[arrPos].basecallPos[i]) > startX) &&
            (parseFloat(window.data.gappedTraces[arrPos].basecallPos[i]) < endX)) {
            var xPos = window.data.tp.frameXst + (parseFloat(window.data.gappedTraces[arrPos].basecallPos[i]) - startX) / (endX - startX)  * (window.data.tp.frameXend - window.data.tp.frameXst);
            retVal += "<line x1='" + xPos + "' y1='" + lineYend;
            retVal += "' x2='" + xPos + "' y2='" + (lineYend + 7)+ "' stroke-width='2' stroke='black' />";
            retVal += "<text x='" + (xPos + 3) + "' y='" + (lineYend + 11);
            retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='end' transform='rotate(-90 ";
            retVal += (xPos + 3) + "," + (lineYend + 11) + ")'>";
            retVal += window.data.gappedTraces[arrPos].basecalls[window.data.gappedTraces[arrPos].basecallPos[i]] + "</text>";

            var refcol = "#ffffff"
            var cChar = window.data.controlSequence.charAt(i + parseInt(window.data.gappedTraces[arrPos].leadingGaps));
            if (cChar == "N") {
                refcol = "#F2F2F2";
            }
            if (cChar == "G") {
                refcol = "#CCFFCC";
            }
            if (cChar == "C") {
                refcol = "#FF9900";
            }
            if (cChar == "M") {
                refcol = "#FF0000";
            }
            if (cChar == "E") {
                refcol = "#00B300";
            }
            retVal += "<rect x='" + (xPos - 5) + "' y='" + (lineYend + 63);
            retVal += "' width='10' height='10' style='fill:" + refcol + ";stroke-width:3;stroke:" + refcol + "' />";
            retVal += "<text x='" + (xPos + 3) + "' y='" + (lineYend + 71);
            retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='end'>";
            retVal += window.data.userEditedSequence.charAt(i + parseInt(window.data.gappedTraces[arrPos].leadingGaps));
            retVal +=  "</text>";
            retVal += "<rect x='" + (xPos - 5) + "' y='" + (lineYend + 83);
            retVal += "' width='10' height='10' style='fill:" + refcol + ";stroke-width:3;stroke:" + refcol + "' />";
            if(window.data.hasOwnProperty('gappedReference')){
                retVal += "<text x='" + (xPos + 3) + "' y='" + (lineYend + 91);
                retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='end'>";
                retVal += window.data.gappedReference.charAt(i + parseInt(window.data.gappedTraces[arrPos].leadingGaps));
                retVal +=  "</text>";
                retVal += "<rect x='" + (xPos - 5) + "' y='" + (lineYend + 103);
                retVal += "' width='10' height='10' style='fill:" + refcol + ";stroke-width:3;stroke:" + refcol + "' />";
                retVal += "<text x='" + (xPos + 3) + "' y='" + (lineYend + 111);
                retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='end'>";
                retVal += window.data.gappedConsensus.charAt(i + parseInt(window.data.gappedTraces[arrPos].leadingGaps));
                retVal +=  "</text>";
            } else {
                retVal += "<text x='" + (xPos + 3) + "' y='" + (lineYend + 91);
                retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='end'>";
                retVal += window.data.gappedConsensus.charAt(i + parseInt(window.data.gappedTraces[arrPos].leadingGaps));
                retVal +=  "</text>";
            }
        }
    }

    // The Y-Axis
    var yPow = Math.pow(10, Math.floor(Math.log10(window.data.tp.winYend/10)));
    var yStep = Math.floor(window.data.tp.winYend/10/yPow) * yPow;
    for (var i = 0; i * yStep < window.data.tp.winYend; i++) {
        var yPos = window.data.tp.frameYend - i * yStep / window.data.tp.winYend * (window.data.tp.frameYend - window.data.tp.frameYst) + 30;
        retVal += "<line x1='" + lineXst + "' y1='" + yPos;
        retVal += "' x2='" + (lineXst - 7) + "' y2='" + yPos + "' stroke-width='2' stroke='black' />";
        retVal += "<text x='" + (lineXst - 11) + "' y='" + (yPos + 3);
        retVal += "' font-family='Arial' font-size='10' fill='black' text-anchor='end'>";
        retVal += (i * yStep) + "</text>";
    }

    return retVal;
}

function createAllCalls(nr, arrPos){
    var retVal = createOneCall(nr, arrPos, window.data.gappedTraces[arrPos].peakA, window.data.tp.baseCol[0]);
    retVal += createOneCall(nr, arrPos, window.data.gappedTraces[arrPos].peakC, window.data.tp.baseCol[1]);
    retVal += createOneCall(nr, arrPos, window.data.gappedTraces[arrPos].peakG, window.data.tp.baseCol[2]);
    retVal += createOneCall(nr, arrPos, window.data.gappedTraces[arrPos].peakT, window.data.tp.baseCol[3]);
    return retVal;
}

function createOneCall(nr, arrPos, trace, col){
    var yShift = 370 * nr + 30
    var focusTr = window.data.gappedTraces[arrPos].basecallPos[window.data.editPosition - parseInt(window.data.gappedTraces[arrPos].leadingGaps)]
    var startX = focusTr - parseInt((window.data.tp.winXend - window.data.tp.winXst) / 2);
    var endX = focusTr + parseInt((window.data.tp.winXend - window.data.tp.winXst) / 2);
    var startTag = "<polyline fill='none' stroke-linejoin='round' stroke='" + col[0];
    startTag += "' stroke-width='" + col[1] + "' points='";
    var retVal = "";
    var lastVal = -99;
    for (var i = startX; i < endX; i++) {
        if(!(typeof trace[i] === 'undefined')){
            var iden = parseFloat(trace[i]);
            if ((lastVal < -90) && (iden > -90)) {
                retVal += startTag;
            }
            if ((lastVal > -90) && (iden < -90)) {
                retVal += "'/>";
            }
            lastVal = iden;
            iden = parseFloat(trace[i]) / window.data.tp.winYend;
            if (iden > 1.0) {
                iden = 1;
            }
            var xPos = window.data.tp.frameXst + (i - startX) / (endX - startX)  * (window.data.tp.frameXend - window.data.tp.frameXst);
            var yPos = window.data.tp.frameYend - iden * (window.data.tp.frameYend - window.data.tp.frameYst);
            retVal += xPos + "," + (yPos + yShift) + " ";
        }
    }
    if (lastVal > -90) {
        retVal += "'/>";
    }
    return retVal;
}

