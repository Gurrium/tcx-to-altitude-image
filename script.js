var data = null
const parser = new DOMParser()
const chart = createChart()
const downloadButton = document.getElementById('download-button')
const exportImageWidthInput = document.getElementById('exportImageWidth')
const exportImageHeightInput = document.getElementById('exportImageHeight')

document.getElementById('route-file').addEventListener('change', event => {
  const fileList = event.target.files;
  fileList[0].text().then(content => {
    data = parseData(content)
    updateChart(data)
  })
})

document.getElementById('maxDistance').addEventListener('input', event => {
  debounce(_ => {
    const parsed = parseFloat(event.target.value)
    if (isNaN(parsed)) {
      maxDistance = null
    } else {
      maxDistance = parsed
      updateMaximumMinDistance(maxDistance)
    }

    updateChart(croppedData(minDistance, maxDistance))
  }, 500)
})

document.getElementById('minDistance').addEventListener('input', event => {
  debounce(_ => {
    const parsed = parseFloat(event.target.value)
    if (isNaN(parsed)) {
      minDistance = null
    } else {
      minDistance = parsed
      updateMinimumMaxDistance(minDistance)
    }

    updateChart(croppedData(minDistance, maxDistance))
  }, 500)
})

document.getElementById('maxAltitude').addEventListener('input', event => {
  debounce(_ => {
    const parsed = parseFloat(event.target.value)
    if (isNaN(parsed)) {
      chart.options.scales.y.max = null
    } else {
      chart.options.scales.y.max = parsed
    }

    chart.update()
  }, 500)
})

var timerID
function debounce(func, delay) {
  clearTimeout(timerID)

  timerID = setTimeout(func, delay)
}

downloadButton.addEventListener('click', _ => { setDownloadData() })

exportImageWidthInput.addEventListener('input', _ => { updateDownloadButton() })
exportImageHeightInput.addEventListener('input', _ => { updateDownloadButton() })

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
}

function disableDownloadButton() {
  downloadButton.classList.add('pure-button-disabled')
}

function setDownloadData() {
  const exportImageWidth = parseInt(exportImageWidthInput.value)
  const exportImageHeight = parseInt(exportImageHeightInput.value)
  if (!isNaN(exportImageWidth) && !isNaN(exportImageHeight)) {
    chart.resize(exportImageWidth, exportImageHeight)
  }

  downloadButton.href = chart.toBase64Image()
  downloadButton.download = `altitudes-${(new Date()).toISOString().split("T")[0]}.png`
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