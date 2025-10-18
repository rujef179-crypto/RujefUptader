const { Octokit } = require('@octokit/rest');

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
        const { versionCode, versionName, agregados, correcciones } = JSON.parse(event.body);
        
        const owner = 'rujef179-crypto';
        const repo = 'RujefUptader';
        const branch = 'main';
        const token = process.env.GITHUB_TOKEN;

        if (!token) {
            throw new Error('GITHUB_TOKEN no configurado en Netlify');
        }

        if (!versionCode || !versionName) {
            throw new Error('Faltan campos requeridos');
        }

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

        // Subir a GitHub
        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: 'public/version.json',
            message: `Actualización versión ${versionName} (v${versionCode})`,
            content: versionContent,
            branch
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                message: '✅ version.json actualizado correctamente en GitHub' 
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: `❌ Error: ${error.message}` 
            })
        };
    }
};
