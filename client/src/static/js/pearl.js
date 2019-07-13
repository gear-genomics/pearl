const API_URL = process.env.API_URL

var traceView = require('./traceView');

const resultLink = document.getElementById('link-results')

const submitButton = document.getElementById('btn-submit')
submitButton.addEventListener('click', showUpload)
const exampleButton = document.getElementById('btn-example')
exampleButton.addEventListener('click', showExample)

const inputFile = document.getElementById('inputFile')
const targetFastaFile = document.getElementById('targetFileFasta')
const targetChromatogramFile = document.getElementById('targetFileChromatogram')
const targetGenomes = document.getElementById('target-genome')
const targetTabs = document.getElementById('target-tabs')
const resultInfo = document.getElementById('result-info')
const resultError = document.getElementById('result-error')

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
  
  //traceView.deleteContent()
  hideElement(resultError)
  traceView.deleteContent()
  showElement(resultInfo)

  axios
    .post(`${API_URL}/upload`, formData)
    .then(res => {
	if (res.status === 200) {
          handleSuccess(res.data)
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
      //traceView.deleteContent()
      showElement(resultError)
      resultError.querySelector('#error-message').textContent = errorMessage
    })
}

function handleSuccess(res) {
//    alert(JSON.stringify(res.data))
    alert(res.data.keys)
    for(var obj in res){
        if(res.hasOwnProperty(obj)){
            for(var prop in res[obj]){
                if(res[obj].hasOwnProperty(prop)){
                   alert(prop + ':' + res[obj][prop]);
                }
            }
        }
    }
    hideElement(resultInfo)
    hideElement(resultError)
    // traceView.displayData(res.data)
}




