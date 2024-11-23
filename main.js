const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const btnDescargarCSV = document.getElementById('btnDescargarCSV');
const btnDescargarJSON = document.getElementById('btnDescargarJSON');

// Prevenir comportamiento por defecto del navegador
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

// Resaltar drop zone cuando se arrastra un archivo sobre ella
['dragenter', 'dragover'].forEach(eventName => {
  dropZone.addEventListener(eventName, highlight, false);
});

['dragleave', 'drop'].forEach(eventName => {
  dropZone.addEventListener(eventName, unhighlight, false);
});

// Manejar archivo soltado
dropZone.addEventListener('drop', handleDrop, false);

// Manejar clic en la zona
dropZone.addEventListener('click', () => fileInput.click());

// Manejar selección de archivo mediante el input
fileInput.addEventListener('change', handleFiles);

function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}

function highlight(e) {
  dropZone.classList.add('drag-over');
}

function unhighlight(e) {
  dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
  const dt = e.dataTransfer;
  const files = dt.files;
  handleFiles({ target: { files: files } });
}

function handleFiles(e) {
  resetearEstado();
  const file = e.target.files[0];
  const reader = new FileReader();

  reader.onload = function (e) {
    const contenido = e.target.result;

    if (file.name.endsWith('.json')) {
      procesarJSON(contenido);
    } else if (file.name.endsWith('.csv')) {
      procesarCSV(contenido);
    } else {
      alert('Por favor, selecciona un archivo JSON o CSV válido');
    }
  };

  reader.readAsText(file);
}

function resetearEstado() {
  document.getElementById('jsonInput').value = '';
  document.getElementById('csvOutput').value = '';
  btnDescargarCSV.setAttribute('disabled', true);
  btnDescargarJSON.setAttribute('disabled', true);
}

function procesarJSON(jsonText) {
  const jsonInputEl = document.getElementById('jsonInput');
  jsonInputEl.classList.remove('active-operation');
  document.getElementById('csvOutput').classList.add('active-operation');
  jsonInputEl.value = jsonText;
  try {
    const jsonData = JSON.parse(jsonText);
    const csv = convertirJSONaCSV(jsonData);
    document.getElementById('csvOutput').value = csv;
    btnDescargarCSV.removeAttribute('disabled');
    btnDescargarJSON.setAttribute('disabled', true)
  } catch (error) {
    alert('Error al procesar el JSON: ' + error);
  }
}

function procesarCSV(csvText) {
  const csvOutputEl = document.getElementById('csvOutput');
  csvOutputEl.value = csvText;

  csvOutputEl.classList.remove('active-operation');
  document.getElementById('jsonInput').classList.add('active-operation');
  try {
    const jsonData = flattenObject(convertirCSVaJSON(csvText));
    document.getElementById('jsonInput').value = JSON.stringify(jsonData, null, 2);
    btnDescargarCSV.setAttribute('disabled', true)
    btnDescargarJSON.removeAttribute('disabled')
  } catch (error) {
    alert('Error al procesar el CSV: ' + error);
  }
}

function convertirCSVaJSON(csv) {
  // Dividir el CSV en líneas y ordenarlas alfabéticamente
  const lines = csv.split('\n')
    .filter(line => line.trim() && !line.startsWith('"Id":"traducción"'))
    .sort();

  const result = {};

  for (const line of lines) {
    // Extraer clave y valor
    const match = line.match(/"([^"]+)":"([^"]*)"/);
    if (!match) continue;

    const [, key, value] = match;

    // Procesar la clave para manejar objetos anidados y arrays
    const parts = key.split('.');
    let target = result;

    parts.forEach((part, index) => {
      // Verificar si es un elemento de array
      const arrayMatch = part.match(/(.+)\[(\d+)\]/);

      if (arrayMatch) {
        // Manejar elementos de array
        const [, arrayName, arrayIndex] = arrayMatch;
        if (!target[arrayName]) target[arrayName] = [];
        if (!target[arrayName][arrayIndex]) target[arrayName][arrayIndex] = {};

        if (index === parts.length - 1) {
          target[arrayName][arrayIndex] = isNaN(value) ? value : Number(value);
        } else {
          target = target[arrayName][arrayIndex];
        }
      } else {
        // Manejar objetos normales
        if (index === parts.length - 1) {
          // Convertir strings numéricos a números
          target[part] = isNaN(value) ? value : Number(value);
        } else {
          if (!target[part]) target[part] = {};
          target = target[part];
        }
      }
    });
  }

  // Función recursiva para ordenar las claves de objetos anidados
  function ordenarObjetoRecursivamente(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
      return obj;
    }

    const ordenado = {};
    Object.keys(obj)
      .sort((a, b) => a.localeCompare(b))
      .forEach(key => {
        ordenado[key] = ordenarObjetoRecursivamente(obj[key]);
      });

    return ordenado;
  }

  // Ordenar el resultado final
  return ordenarObjetoRecursivamente(result);
}

function convertirJSONaCSV(jsonData) {
  if (!Array.isArray(jsonData)) {
    jsonData = [jsonData];
  }

  const csvRows = [`"Id": "traducción"`];

  // Para cada objeto en el JSON
  for (const obj of jsonData) {
    // Aplanar el objeto
    const flattenedObj = flattenObject(obj);

    // Para cada propiedad del objeto aplanado
    for (const [key, value] of Object.entries(flattenedObj)) {
      // Escapar comillas dobles en los valores si existen
      const escapedValue = String(value).replace(/"/g, '""');
      // Agregar clave y valor como una nueva fila
      csvRows.push(`"${key}":"${escapedValue}"`);
    }
    // Agregar una línea en blanco entre objetos si hay más de uno
    if (jsonData.length > 1) {
      csvRows.push('');
    }
  }

  return csvRows.join('\n');
}

function flattenObject(obj, prefix = '') {
  return Object.keys(obj).reduce((acc, key) => {
    const pre = prefix.length ? prefix + '.' : '';

    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      // Si es un objeto anidado, recursivamente aplanarlo
      Object.assign(acc, flattenObject(obj[key], pre + key));
    } else if (Array.isArray(obj[key])) {
      // Si es un array, convertirlo a string o procesarlo elemento por elemento
      if (obj[key].length === 0) {
        acc[pre + key] = '';
      } else if (typeof obj[key][0] === 'object') {
        // Si el array contiene objetos, aplanarlos individualmente
        obj[key].forEach((item, index) => {
          Object.assign(acc, flattenObject(item, `${pre}${key}[${index}]`));
        });
      } else {
        // Si es un array de valores primitivos, unirlos
        acc[pre + key] = obj[key].join(', ');
      }
    } else {
      // Si es un valor primitivo, agregarlo directamente
      acc[pre + key] = obj[key];
    }

    return acc;
  }, {});
}

function descargarCSV() {
  const csv = document.getElementById('csvOutput').value;
  if (!csv) {
    alert('No hay datos CSV para descargar');
    return;
  }

  // Crear un elemento input tipo file invisible
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.csv';
  fileInput.style.display = 'none';
  document.body.appendChild(fileInput);

  // Mostrar el diálogo para guardar archivo
  const pickerOpts = {
    types: [{
      description: 'Archivo CSV',
      accept: { 'text/csv': ['.csv'] }
    }],
    suggestedName: 'datos.csv'
  };

  // Usar el File System Access API si está disponible
  if ('showSaveFilePicker' in window) {
    window.showSaveFilePicker(pickerOpts)
      .then(async (fileHandle) => {
        const writable = await fileHandle.createWritable();
        await writable.write(csv);
        await writable.close();
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Error al guardar el archivo:', err);
          alert('Error al guardar el archivo');
        }
      });
  } else {
    // Fallback para navegadores que no soportan File System Access API
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'datos.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}

function descargarJSON() {
  const json = document.getElementById('jsonInput').value;
  if (!json) {
    alert('No hay datos JSON para descargar');
    return;
  }

  const pickerOpts = {
    types: [{
      description: 'Archivo JSON',
      accept: { 'application/json': ['.json'] }
    }],
    suggestedName: 'datos.json'
  };

  if ('showSaveFilePicker' in window) {
    window.showSaveFilePicker(pickerOpts)
      .then(async (fileHandle) => {
        const writable = await fileHandle.createWritable();
        await writable.write(json);
        await writable.close();
      })
      .catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Error al guardar el archivo:', err);
          alert('Error al guardar el archivo');
        }
      });
  } else {
    const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'datos.json';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
