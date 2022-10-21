import * as Chart from "chart.js"

var data: Chart.ChartPoint[] = []
var splitPoints: number[] = []
var maxDistance: number | null
var minDistance: number | null

const parser = new DOMParser()
const chart = createChart()
const fileInput = document.getElementById('route-file') as HTMLInputElement
const downloadButton = document.getElementById('download-button') as HTMLButtonElement
const hiddenDownloadLink = document.getElementById('hidden-download-link') as HTMLAnchorElement
const exportImageWidthInput = document.getElementById('exportImageWidth') as HTMLInputElement
const exportImageHeightInput = document.getElementById('exportImageHeight') as HTMLInputElement
const splitPointsInput = document.getElementById('splitPoints') as HTMLInputElement
const exportImageFontSizeInput = document.getElementById('exportImageFontSize') as HTMLInputElement
const maxDistanceInput = document.getElementById('maxDistance') as HTMLInputElement
const minDistanceInput = document.getElementById('minDistance') as HTMLInputElement
const maxAltitudeInput = document.getElementById('maxAltitude') as HTMLInputElement
const shouldFillInput = document.getElementById('shouldFill') as HTMLInputElement

fileInput?.addEventListener('change', (event: InputEvent) => {
  const fileList = (event?.target as HTMLInputElement).files;
  fileList?.item(0)?.text().then(content => {
    data = parseData(content)
    updateChart(data)
  })

  sendLoadFileEvent()
})

maxDistanceInput?.addEventListener('input', event => {
  debounce(({ }) => {
    const parsed = parseFloat((event.target as HTMLInputElement).value)
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

minDistanceInput?.addEventListener('input', event => {
  debounce(({ }) => {
    const parsed = parseFloat((event.target as HTMLInputElement).value)
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

maxAltitudeInput?.addEventListener('input', event => {
  debounce(({ }) => {
    if (chart.options.scales?.yAxes?.[0].ticks?.max == undefined) { return }

    const parsed = parseFloat((event.target as HTMLInputElement).value)

    if (isNaN(parsed)) {
      chart.options.scales.yAxes[0].ticks.max = null
    } else {
      chart.options.scales.yAxes[0].ticks.max = parsed
    }

    chart.update()

    sendChangeChartSettingsEvent()
  }, 500)
})

var timerID: number
function debounce(func: TimerHandler, delay: number) {
  clearTimeout(timerID)

  timerID = setTimeout(func, delay)
}

shouldFillInput?.addEventListener('input', event => {
  if (chart.data.datasets?.[0].backgroundColor == undefined) { return }

  chart.data.datasets[0].backgroundColor = (event.target as HTMLInputElement).checked ? 'rgb(255, 99, 132)' : 'rgba(0, 0, 0, 0)'
  chart.update()

  sendChangeChartSettingsEvent()
})

downloadButton?.addEventListener('click', e => {
  download()

  sendDownloadImageEvent()

  e.preventDefault()
})

exportImageWidthInput?.addEventListener('input', event => {
  updateDownloadButton()

  if ((event.target as HTMLInputElement).value == '') {
    exportImageHeightInput?.removeAttribute('required')
  } else {
    exportImageHeightInput?.setAttribute('required', '')
  }
})

exportImageHeightInput?.addEventListener('input', event => {
  updateDownloadButton()

  if ((event.target as HTMLInputElement).value == '') {
    exportImageWidthInput?.removeAttribute('required')
  } else {
    exportImageWidthInput?.setAttribute('required', '')
  }
})

splitPointsInput?.addEventListener('input', event => {
  const target = (event.target as HTMLInputElement)
  var validityMessages: string[] = []
  var rawSplitPoints: number[] = []

  if (target.validity.patternMismatch) {
    validityMessages.push('カンマ（,）区切りの半角数字で入力してください')
  } else {
    rawSplitPoints = target.value.split(',')
      .map(s => {
        const point = parseFloat(s)

        return isNaN(point) ? null : point
      })
      .filter((e): e is number => e != null)

    const minDistance = parseFloat(minDistanceInput?.value)
    const maxDistance = parseFloat(maxDistanceInput?.value)
    var prev = 0
    rawSplitPoints.forEach(current => {
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
    target.setCustomValidity('')

    splitPoints = rawSplitPoints
  } else {
    target.setCustomValidity(validityMessages.join("\n"))
  }

  target.reportValidity()
  updateDownloadButton()
})

function parseData(content: string): Chart.ChartPoint[] {
  const doc = parser.parseFromString(content, 'text/xml')
  const trackpointTags = [...doc.getElementsByTagName('Trackpoint')]

  return trackpointTags
    .map(function (tag): Chart.ChartPoint | null {
      const distanceTag = tag.querySelector('DistanceMeters')
      const altitudeTag = tag.querySelector('AltitudeMeters')
      if (distanceTag?.textContent == null || altitudeTag?.textContent == null) {
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
    .filter((element): element is Chart.ChartPoint => {
      return element != null
    })
}

function croppedData(minDistance: number | null, maxDistance: number | null) {
  var minIndex = null
  var maxIndex = null

  if (minDistance != null) {
    minIndex = data.findIndex(point => point.x && point.x >= minDistance)

    if (minIndex == -1) {
      minIndex = null
    }
  }

  if (maxDistance != null) {
    maxIndex = data.findIndex(point => point.x && point.x >= maxDistance)

    if (maxIndex == -1) {
      maxIndex = null
    } else {
      maxIndex += 1
    }
  }

  return data.slice(minIndex == null ? 0 : minIndex, maxIndex == null ? data.length : maxIndex)
}

interface XScale extends Chart.ChartScales {

}

function createChart(): Chart {
  const ctx = (document.getElementById('chart') as HTMLCanvasElement).getContext('2d');
  const chartData: Chart.ChartData = {
    datasets: [{
      data: [],
      fill: true,
      backgroundColor: 'rgb(255, 99, 132)',
      borderColor: 'rgb(255, 99, 132)',
      pointRadius: 0,
      pointHitRadius: 2,
    }]
  }
  const options: Chart.ChartConfiguration = {
    options: {
      scales: {
        xAxes: [{
          type: 'linear',
          ticks: {
            min: 0,
          },
          scaleLabel: {
            display: true,
            labelString: '距離[km]'
          },
        }],
        yAxes: [{
          type: 'linear',
          ticks: {
            min: 0,
          },
          scaleLabel: {
            display: true,
            labelString: '標高[m]'
          },
        }],
      },
      plugins: [{
        legend: {
          display: false
        }
      }],
      animation: {
        onComplete: _ => {
          updateDownloadButton()
        }
      },
      maintainAspectRatio: false,
    },
  }

  return new Chart(ctx!, {
    type: 'line',
    data: chartData,
    options: options,
  })
}

function updateChart(updatedData: Chart.ChartPoint[], animated = true) {
  if (chart.data.datasets != undefined) {
    chart.data.datasets[0].data = updatedData
  }

  if (chart.options.scales?.xAxes?.[0]?.ticks != undefined) {
    chart.options.scales.xAxes[0].ticks.min = updatedData[0].x
    chart.options.scales.xAxes[0].ticks.max = updatedData[updatedData.length - 1].x
  }

  chart.update(animated ? {} : undefined)
}

// TODO: それぞれのevent listenerでvalidityを更新するほうが健全だと思う
function updateDownloadButton() {
  const width = parseInt(exportImageWidthInput.value)
  const height = parseInt(exportImageHeightInput.value)

  const isValidDataShown = chart.data.datasets?.[0].data?.length ?? 0 > 1
  const isValidSizeInput = (isNaN(width) && isNaN(height)) || (!isNaN(width) && !isNaN(height))
  const isValidSplitPoints = splitPointsInput.validity.valid

  if (isValidSizeInput && isValidDataShown && isValidSplitPoints) {
    enableDownloadButton()
  } else {
    disableDownloadButton()
  }
}

function enableDownloadButton() {
  downloadButton.disabled = false
}

function disableDownloadButton() {
  downloadButton.disabled = true
}

function download() {
  const exportImageWidth = parseInt(exportImageWidthInput.value)
  const exportImageHeight = parseInt(exportImageHeightInput.value)
  if (!isNaN(exportImageWidth) && !isNaN(exportImageHeight)) {
    chart.width = exportImageWidth
    chart.height = exportImageHeight
    chart.resize()
  }

  const exportImageFontSize = parseInt(exportImageFontSizeInput.value)
  const defaultFontSize = Chart.defaults.font.size
  if (!isNaN(exportImageFontSize)) {
    Chart.defaults.font.size = exportImageFontSize
    chart.update({ duration: 0 })
  }

  var baseOutputFileName = 'elevation'

  const inputFile = fileInput?.files?.item(0)
  if (inputFile != null && inputFile.name.split('.').length > 1) {
    baseOutputFileName = inputFile.name.split('.').slice(0, -1).join() + '-' + baseOutputFileName
  }

  if (splitPoints.length > 0) {
    const data = (chart.data.datasets?.[0].data as Chart.ChartPoint[])
    var minDistance = data[0].x
    var maxDistance = data[data.length - 1].x

    var lower = minDistance
    splitPoints.concat(maxDistance).forEach(upper => {
      updateChart(croppedData(lower, upper), false)

      hiddenDownloadLink.href = chart.toBase64Image()
      hiddenDownloadLink.download = `${baseOutputFileName}-${upper}.png`
      hiddenDownloadLink.click()

      lower = upper
    })

    updateChart(croppedData(minDistance, maxDistance), false)
  } else {
    hiddenDownloadLink.href = chart.toBase64Image()
    hiddenDownloadLink.download = baseOutputFileName + '.png'
    hiddenDownloadLink.click()
  }

  Chart.defaults.font.size = defaultFontSize
  chart.update({ duration: 0 }) // TODO: {}でもいいかも
  chart.resize()
}

function updateMaximumMinDistance(maxDistance: number) {
  minDistanceInput.max = maxDistance.toString()
}

function updateMinimumMaxDistance(minDistance: number) {
  maxDistanceInput.min = minDistance.toString()
}

function retrieveDisplaySettings() {
  return {
    'min_distance': maxDistanceInput.value,
    'max_distance': minDistanceInput.value,
    'max_altitude': maxAltitudeInput.value,
    'should_fill': shouldFillInput.value,
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
      'split_points': splitPoints,
    }
  )
}
