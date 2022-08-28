var data = null
const parser = new DOMParser()
const chart = createChart()
const fileInput = document.getElementById('route-file')
const downloadButton = document.getElementById('download-button')
const hiddenDownloadLink = document.getElementById('hidden-download-link')
const exportImageWidthInput = document.getElementById('exportImageWidth')
const exportImageHeightInput = document.getElementById('exportImageHeight')
const splitPointsInput = document.getElementById('splitPoints')
const maxDistanceInput = document.getElementById('maxDistance')
const minDistanceInput = document.getElementById('minDistance')
const maxAltitudeInput = document.getElementById('maxAltitude')
const shouldFillInput = document.getElementById('shouldFill')

fileInput.addEventListener('change', event => {
  const fileList = event.target.files;
  fileList[0].text().then(content => {
    data = parseData(content)
    updateChart(data)
  })

  sendLoadFileEvent()
})

maxDistanceInput.addEventListener('input', event => {
  debounce(_ => {
    const parsed = parseFloat(event.target.value)
    if (isNaN(parsed)) {
      maxDistance = null
    } else {
      maxDistance = parsed
      updateMaximumMinDistance(maxDistance)
    }

    updateChart(croppedData(minDistance, maxDistance))

    sendChangeChartSettingsEvent()
  }, 500)
})

minDistanceInput.addEventListener('input', event => {
  debounce(_ => {
    const parsed = parseFloat(event.target.value)
    if (isNaN(parsed)) {
      minDistance = null
    } else {
      minDistance = parsed
      updateMinimumMaxDistance(minDistance)
    }

    updateChart(croppedData(minDistance, maxDistance))

    sendChangeChartSettingsEvent()
  }, 500)
})

maxAltitudeInput.addEventListener('input', event => {
  debounce(_ => {
    const parsed = parseFloat(event.target.value)
    if (isNaN(parsed)) {
      chart.options.scales.y.max = null
    } else {
      chart.options.scales.y.max = parsed
    }

    chart.update()

    sendChangeChartSettingsEvent()
  }, 500)
})

var timerID
function debounce(func, delay) {
  clearTimeout(timerID)

  timerID = setTimeout(func, delay)
}

shouldFillInput.addEventListener('input', event => {
  chart.data.datasets[0].backgroundColor = event.target.checked ? 'rgb(255, 99, 132)' : 'rgba(0, 0, 0, 0)'
  chart.update()

  sendChangeChartSettingsEvent()
})

downloadButton.addEventListener('click', e => {
  download()

  sendDownloadImageEvent()

  e.preventDefault()
})

exportImageWidthInput.addEventListener('input', event => {
  updateDownloadButton()

  if (event.target.value == '') {
    exportImageHeightInput.removeAttribute('required')
  } else {
    exportImageHeightInput.setAttribute('required', '')
  }
})

exportImageHeightInput.addEventListener('input', event => {
  updateDownloadButton()

  if (event.target.value == '') {
    exportImageWidthInput.removeAttribute('required')
  } else {
    exportImageWidthInput.setAttribute('required', '')
  }
})

splitPointsInput.addEventListener('input', event => {
  var validityMessages = []

  if (event.target.validity.patternMismatch) {
    // TODO: 別にカンマ区切りでなくていいのでは
    // [0-9][^0-9]+[0-9]+みたいなのでも
    validityMessages.push('カンマ（,）区切りの半角数字で入力してください')
  } else {
    const splitPoints = event.target.value.split(',')
      .map(s => {
        const point = parseFloat(s)

        return isNaN(point) ? null : point
      })
      .filter(e => e)

    const minDistance = parseFloat(minDistanceInput.value)
    const maxDistance = parseFloat(maxDistanceInput.value)
    var prev = 0
    splitPoints.forEach(current => {
      if (prev >= current) {
        validityMessages.push("昇順に指定してください")
      }

      if (current < minDistance || maxDistance < current) {
        validityMessages.push("表示されている範囲で指定してください")
      }

      prev = current
    })
  }

  if (validityMessages.length == 0) {
    event.target.setCustomValidity('')
  } else {
    event.target.setCustomValidity(validityMessages.join("\n"))
  }

  event.target.reportValidity()
})

function parseData(content) {
  const doc = parser.parseFromString(content, 'text/xml')
  const trackpointTags = [...doc.getElementsByTagName('Trackpoint')]
  return trackpointTags
    .map(tag => {
      const distanceTag = tag.querySelector('DistanceMeters')
      const altitudeTag = tag.querySelector('AltitudeMeters')
      if (distanceTag == null || altitudeTag == null) {
        return null
      }

      const distance = parseFloat(distanceTag.textContent)
      const altitude = parseFloat(altitudeTag.textContent)
      if (isNaN(altitude) || isNaN(distance)) {
        return null
      }

      return {
        x: distance / 1000,
        y: altitude
      }
    })
    .filter(e => e)
}

function croppedData(minDistance, maxDistance) {
  var minIndex = null
  var maxIndex = null

  if (!(minDistance == null)) {
    minIndex = data.findIndex(e => e.x >= minDistance)

    if (minIndex == -1) {
      minIndex = null
    }
  }

  if (!(maxDistance == null)) {
    maxIndex = data.findIndex(e => e.x >= maxDistance)

    if (maxIndex == -1) {
      maxIndex = null
    } else {
      maxIndex += 1
    }
  }

  return data.slice(minIndex == null ? 0 : minIndex, maxIndex == null ? data.length : maxIndex)
}

function createChart() {
  const ctx = document.getElementById('chart').getContext('2d');
  const chartData = {
    datasets: [{
      data: [],
      fill: true,
      backgroundColor: 'rgb(255, 99, 132)',
      borderColor: 'rgb(255, 99, 132)',
    }]
  }
  const options = {
    scales: {
      x: {
        type: 'linear',
        min: 0,
        title: {
          display: true,
          text: '距離[km]'
        },
      },
      y: {
        type: 'linear',
        min: 0,
        title: {
          display: true,
          text: '標高[m]'
        },
      }
    },
    pointRadius: 0,
    pointHitRadius: 2,
    plugins: {
      legend: {
        display: false,
      },
    },
    animation: {
      onComplete: _ => {
        updateDownloadButton()
      }
    },
    maintainAspectRatio: false,
  }

  return new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: options,
  })
}

function updateChart(updatedData) {
  chart.data.datasets[0].data = updatedData
  chart.options.scales.x.min = updatedData[0].x
  chart.options.scales.x.max = updatedData[updatedData.length - 1].x
  chart.update()
}

// TODO: それぞれのevent listenerでvalidityを更新するほうが健全だと思う
function updateDownloadButton() {
  const width = parseInt(exportImageWidthInput.value)
  const height = parseInt(exportImageHeightInput.value)

  const isValidSizeInput = (isNaN(width) && isNaN(height)) || (!isNaN(width) && !isNaN(height))
  const isValidDataShown = chart.data.datasets[0].data.length > 1

  if (isValidDataShown && isValidSizeInput) {
    enableDownloadButton()
  } else {
    disableDownloadButton()
  }
}

function enableDownloadButton() {
  downloadButton.classList.remove('pure-button-disabled')
  downloadButton.disabled = false
}

function disableDownloadButton() {
  downloadButton.classList.add('pure-button-disabled')
  downloadButton.disabled = true
}

function download() {
  const exportImageWidth = parseInt(exportImageWidthInput.value)
  const exportImageHeight = parseInt(exportImageHeightInput.value)
  if (!isNaN(exportImageWidth) && !isNaN(exportImageHeight)) {
    chart.resize(exportImageWidth, exportImageHeight)
  }

  var outputFileName = 'elevation.png'
  const inputFile = fileInput.files[0]
  if (inputFile != null && inputFile.name.split('.').length > 1) {
    outputFileName = inputFile.name.split('.').slice(0, -1).join() + '-' + outputFileName
  }

  hiddenDownloadLink.href = chart.toBase64Image()
  hiddenDownloadLink.download = outputFileName
  hiddenDownloadLink.click()

  chart.resize()
}

function updateMaximumMinDistance(maxDistance) {
  const minDistanceInput = document.getElementById('minDistance')
  minDistanceInput.max = maxDistance
}

function updateMinimumMaxDistance(minDistance) {
  const maxDistanceInput = document.getElementById('maxDistance')
  maxDistanceInput.min = minDistance
}

function retrieveDisplaySettings() {
  return {
    'min_distance': nullOrNonBlankString(maxDistanceInput.value),
    'max_distance': nullOrNonBlankString(minDistanceInput.value),
    'max_altitude': nullOrNonBlankString(maxAltitudeInput.value),
    'should_fill': nullOrNonBlankString(shouldFillInput.value),
  }
}

function sendLoadFileEvent() {
  dataLayer.push(
    {
      'event': 'load_file',
    }
  )
}

function sendChangeChartSettingsEvent() {
  dataLayer.push(
    {
      'event': 'change_chart_settings',
      ...retrieveDisplaySettings()
    }
  )
}

function sendDownloadImageEvent() {
  dataLayer.push(
    {
      'event': 'download_image',
      ...retrieveDisplaySettings(),
      // TODO: ダウンロード設定もretrieveDisplaySettingsっぽくする
      'width': exportImageWidthInput.value,
      'height': exportImageHeightInput.value,
      // TODO: 分割地点も送る
    }
  )
}

function nullOrNonBlankString(string) {
  return string == '' ? null : string
}
