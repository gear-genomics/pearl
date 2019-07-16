const API_URL = process.env.API_URL

// var traceView = require('./traceView');

const resultLink = document.getElementById('link-results')

const submitButton = document.getElementById('btn-submit')
submitButton.addEventListener('click', showUpload)
const exampleButton = document.getElementById('btn-example')
exampleButton.addEventListener('click', showExample)
const saveButton = document.getElementById('btn-save-Json')
saveButton.addEventListener('click', saveJsonFile)
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
    // Create a user edited sequence from reference or alignment
    if ((window.data.hasOwnProperty("msa")) && (window.data.msa.length > 0)) {
        for (var i = 0 ; i < window.data.msa.length ; i++) {
            if ((window.data.msa[i].hasOwnProperty("reference")) &&
                (window.data.msa[i].reference == true) &&
                (window.data.msa[i].hasOwnProperty("align"))) {
                window.data["userEditedSequence"] = window.data.msa[i].align
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

    // First paint it N or M based on reference and consensus
    if ((window.data.hasOwnProperty("userEditedSequence")) &&
        (window.data.hasOwnProperty("gappedConsensus"))) {
        var colSeq = ""
        for (var i = 0; i < window.data.userEditedSequence.length ; i++) {
            if (window.data.userEditedSequence.charAt(i) == window.data.gappedConsensus.charAt(i)) {
                if (window.data.userEditedSequence.charAt(i) == "-") {
                    colSeq += "M"  // M - mismatch
                } else {
                    colSeq += "N"  // N - no information
                }
            } else {
                colSeq += "M"  // M - mismatch
            }
        }
        window.data["controlSequence"] = colSeq
    }
    // Focus on Position
    window.data["editPosition"] = 0
    // Loop through the alignments without reference to set C and G
    if ((window.data.hasOwnProperty("msa")) && (window.data.msa.length > 0) &&
        (window.data.hasOwnProperty("userEditedSequence")) &&
        (window.data.hasOwnProperty("controlSequence")) &&
        (window.data.hasOwnProperty("gappedConsensus"))) {
        var colSeq = ""
        for (var i = 0; i < window.data.userEditedSequence.length ; i++) {
            var baseCode = "n" // n - not set
            var baseCons = "0"
            for (var k = 0 ; k < window.data.msa.length ; k++) {
                 if (window.data.msa[k].reference == false) {
                     var base = window.data.msa[k].align.charAt(i)
                     if (baseCode == "n") {
                         if (base != "-") {
                             baseCode = "G"
                         }
                         baseCons = base
                     }
                     if ((baseCons != base) && (base != "-")) { // Fixme: "-" should trigger C if inside seq
                         baseCode = "C"
                         if (window.data.editPosition == 0) {
                             window.data.editPosition = i
                         }
                     }
                 }
            }
            if (((baseCode == "G") || (baseCode == "C")) && (window.data.controlSequence.charAt(i) == "N")) {
                colSeq += baseCode
            } else {
                colSeq += window.data.controlSequence.charAt(i)
            }
        }
        window.data.controlSequence = colSeq
    }







    //alert(JSON.stringify(window.data))
    for(var obj in window.data.msa){
        if(window.data.msa.hasOwnProperty(obj)){
            for(var prop in window.data[obj]){
                if(window.data[obj].hasOwnProperty(prop)){
                 //  alert(prop + ':' + window.data[obj][prop]);
                }
            }
        }
    }
    hideElement(resultInfo)
    hideElement(resultError)
    repaintData()
    // traceView.displayData(res.data)
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
    retHtml += '  </div>\n';




    resultData.innerHTML = retHtml
}

window.decideBase = decideBase;
function decideBase(base) {
    window.data.userEditedSequence = window.data.userEditedSequence.substr(0, window.data.editPosition) + base + window.data.userEditedSequence.substr(window.data.editPosition + 1);
    window.data.controlSequence = window.data.controlSequence.substr(0, window.data.editPosition) + "E" + window.data.controlSequence.substr(window.data.editPosition + 1);
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
        beforeText = beforeText.replace(/<span style="background-color:*[^" ]+">/ig, " ");
        beforeText = beforeText.replace(/<\/span>/g, " ");
        beforeText = beforeText.replace(/<a [^>]+>/ig, " ");
        beforeText = beforeText.replace(/<\/a>/g, " ");
        beforeText = beforeText.replace(/<br[ \/]*>/g, " ");
        beforeText = beforeText.replace(/<strong>/ig, "");
        beforeText = beforeText.replace(/<\/strong>/ig, "");
        beforeText = beforeText.replace(/\d/ig, "");
        beforeText = beforeText.replace(/\W/ig, "");
        window.data.editPosition = beforeText.length;
        repaintData();
    }
}


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
