const { Octokit } = require('@octokit/rest');

// Helper para parsear FormData
function parseFormData(body) {
  const pairs = body.split('&');
  const result = {};
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=');
    result[decodeURIComponent(key)] = decodeURIComponent(value || '');
  }
  
  return result;
}

exports.handler = async (event) => {
  // Configurar CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Manejar preflight OPTIONS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Solo permitir POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  try {
    console.log('Procesando upload...');
    
    // Netlify no parsea FormData automáticamente, lo hacemos manualmente
    const boundary = event.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      throw new Error('No se pudo detectar boundary en FormData');
    }

    // Parsear el FormData manualmente
    const body = event.body;
    const parts = body.split(`--${boundary}`);
    
    const fields = {};
    let apkFile = null;

    for (const part of parts) {
      if (part.includes('Content-Disposition')) {
        const nameMatch = part.match(/name="([^"]+)"/);
        if (nameMatch) {
          const name = nameMatch[1];
          const value = part.split('\r\n\r\n')[1]?.split('\r\n')[0];
          
          if (name === 'apkFile' && value) {
            // El archivo viene como string, necesitamos manejarlo diferente
            apkFile = value;
          } else if (value) {
            fields[name] = value;
          }
        }
      }
    }

    console.log('Campos recibidos:', Object.keys(fields));
    
    const { versionCode, versionName, agregados, correcciones } = fields;

    if (!versionCode || !versionName) {
      throw new Error('Faltan campos requeridos: versionCode y versionName');
    }

    const owner = 'rujef179-crypto';
    const repo = 'RujefUptader';
    const branch = 'main';
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
      throw new Error('Token de GitHub no configurado en Netlify');
    }

    const octokit = new Octokit({ auth: token });

    // Para archivos, necesitamos una aproximación diferente
    // Vamos a crear un nombre único para el APK
    const fileName = `app-${versionName}-${Date.now()}.apk`;
    const apkPath = `public/apk/${fileName}`;

    // Primero subimos el version.json (más simple para probar)
    const versionData = {
      versionCode: parseInt(versionCode),
      versionName: versionName,
      agregados: agregados || "",
      correcciones: correcciones || "",
      downloadUrl: `https://github.com/${owner}/${repo}/releases/latest`, // Cambiado temporalmente
      timestamp: new Date().toISOString()
    };

    const versionContent = Buffer.from(JSON.stringify(versionData, null, 2)).toString('base64');

    console.log('Subiendo version.json...');
    
    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'public/version.json',
      message: `Actualización versión ${versionName} (v${versionCode})`,
      content: versionContent,
      branch
    });

    console.log('version.json subido correctamente');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ 
        message: '✅ version.json actualizado correctamente en GitHub' 
      })
    };

  } catch (error) {
    console.error('Error detallado:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: `❌ Error: ${error.message}` 
      })
    };
  }
};
