var myChart
const fileSelector = document.getElementById('route-file')
fileSelector.addEventListener('change', (event) => {
  const fileList = event.target.files;
  fileList[0].text().then(value => {
    const parser = new DOMParser()
    const doc = parser.parseFromString(value, 'text/xml')
    const trackpointTags = [...doc.getElementsByTagName('Trackpoint')]
    const data = trackpointTags
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
          x: distance,
          y: altitude
        }
      })
      .filter(e => e)

    createChart(data)
  })
});

function createChart(data) {
  const ctx = document.getElementById('chart').getContext('2d');
  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      datasets: [{
        data: data,
        fill: true,
        backgroundColor: 'rgb(255, 99, 132)',
        borderColor: 'rgb(255, 99, 132)',
      }]
    },
    options: {
      scales: {
        x: {
          type: 'linear',
          min: 0,
        },
        y: {
          type: 'linear',
          min: 0,
        }
      },
      pointRadius: 0,
    }
  })
}

function downloadImage() {
  const downloadButton = document.getElementById('download-button')
  downloadButton.href = myChart.toBase64Image()
  downloadButton.download = `altitudes-${(new Date()).toISOString().split("T")[0]}.png`
  // downloadButton.click()
  // TODO: これ動きが自明じゃない気がする
}

