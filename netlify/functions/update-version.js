const { Octokit } = require('@octokit/rest');

// Helper para parsear FormData
async function parseFormData(event) {
  const contentType = event.headers['content-type'];
  
  if (contentType && contentType.includes('multipart/form-data')) {
    // Para FormData (con archivo APK)
    const boundary = contentType.split('boundary=')[1];
    const body = event.body;
    const parts = body.split(`--${boundary}`);
    
    const fields = {};
    let apkFile = null;

    for (const part of parts) {
      if (part.includes('Content-Disposition')) {
        const nameMatch = part.match(/name="([^"]+)"/);
        if (nameMatch) {
          const name = nameMatch[1];
          if (name === 'apkFile') {
            // Manejar archivo (simplificado por ahora)
            apkFile = 'file_placeholder';
          } else {
            const value = part.split('\r\n\r\n')[1]?.split('\r\n')[0];
            if (value) fields[name] = value;
          }
        }
      }
    }
    
    return { ...fields, apkFile };
  } else {
    // Para JSON (sin archivo APK)
    return JSON.parse(event.body);
  }
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Método no permitido' })
    };
  }

  try {
    console.log('Procesando actualización...');
    
    const data = await parseFormData(event);
    const { versionCode, versionName, agregados, correcciones, apkFile } = data;
    
    const owner = 'rujef179-crypto';
    const repo = 'RujefUptader';
    const branch = 'main';
    const token = process.env.GITHUB_TOKEN;

    if (!token) throw new Error('GITHUB_TOKEN no configurado en Netlify');
    if (!versionCode || !versionName) throw new Error('Faltan campos requeridos');

    const octokit = new Octokit({ auth: token });

    // Crear version.json
    const versionData = {
      versionCode: parseInt(versionCode),
      versionName: versionName,
      agregados: agregados || "",
      correcciones: correcciones || "",
      downloadUrl: `https://github.com/${owner}/${repo}/releases/latest`,
      timestamp: new Date().toISOString()
    };

    const versionContent = Buffer.from(JSON.stringify(versionData, null, 2)).toString('base64');

    await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'public/version.json',
      message: `Actualización versión ${versionName} (v${versionCode})${apkFile ? ' + APK' : ''}`,
      content: versionContent,
      branch
    });

    let message = '✅ version.json actualizado correctamente en GitHub';
    if (apkFile) {
      message += '\n📱 APK listado para subir (función en desarrollo)';
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message })
    };

  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: `❌ Error: ${error.message}` })
    };
  }
};