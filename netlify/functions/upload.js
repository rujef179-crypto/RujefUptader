const { Octokit } = require('@octokit/rest');

exports.handler = async (event) => {
    // Solo permitir POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Método no permitido' })
        };
    }

    try {
        // Netlify parsea el FormData automáticamente
        const { apkFile, versionCode, versionName, agregados, correcciones } = JSON.parse(event.body);
        
        const owner = 'rujef179-crypto';
        const repo = 'RujefUptader';
        const branch = 'main';
        const token = process.env.GITHUB_TOKEN; // Seguro en variables de entorno

        if (!token) {
            throw new Error('Token de GitHub no configurado');
        }

        const octokit = new Octokit({ auth: token });

        const fileName = `app-${versionName}-${Date.now()}.apk`;
        const apkPath = `public/apk/${fileName}`;

        // Subir APK (asumiendo que apkFile viene en base64)
        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: apkPath,
            message: `Subida versión ${versionName} (v${versionCode})`,
            content: apkFile, // base64
            branch
        });

        // Crear version.json
        const versionData = {
            versionCode: parseInt(versionCode),
            versionName: versionName,
            agregados: agregados || "",
            correcciones: correcciones || "",
            downloadUrl: `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${apkPath}`,
            timestamp: new Date().toISOString()
        };

        const versionContent = Buffer.from(JSON.stringify(versionData, null, 2)).toString('base64');

        await octokit.rest.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: 'public/version.json',
            message: `Actualización versión ${versionName}`,
            content: versionContent,
            branch
        });

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                message: '✅ APK subida y version.json actualizado correctamente' 
            })
        };

    } catch (error) {
        console.error('Error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: '❌ Error: ' + error.message })
        };
    }
};
