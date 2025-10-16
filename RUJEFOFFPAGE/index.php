<?php
$message = '';
$notice = "⚠️ Esta página sube APKs a GitHub Releases y mantiene solo las últimas 2 versiones.";

// ==================== CONFIGURACIÓN ====================
$githubToken = 'TU_PERSONAL_ACCESS_TOKEN'; // reemplaza con tu token
$owner = 'TU_USUARIO';                     // tu usuario de GitHub
$repo = 'TU_REPOSITORIO';                  // repositorio donde está este PHP
$releaseTag = 'latest-apks';               // tag del release donde subirás los APKs

// ==================== FUNCIONES ====================
function githubRequest($url, $method = 'GET', $data = null, $headers = []) {
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    if ($data) curl_setopt($ch, CURLOPT_POSTFIELDS, $data);
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    $result = curl_exec($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);
    return ['result' => $result, 'info' => $info];
}

// Obtener info del release
function getRelease($owner, $repo, $tag, $token) {
    $response = githubRequest(
        "https://api.github.com/repos/$owner/$repo/releases/tags/$tag",
        'GET',
        null,
        ["Authorization: token $token", "User-Agent: PHP"]
    );
    return json_decode($response['result'], true);
}

// Subir asset a release
function uploadAsset($owner, $repo, $releaseData, $filePath, $token) {
    $fileName = basename($filePath);
    $uploadUrl = str_replace("{?name,label}", "?name=$fileName", $releaseData['upload_url']);
    $content = file_get_contents($filePath);
    $response = githubRequest(
        $uploadUrl,
        'POST',
        $content,
        [
            "Authorization: token $token",
            "Content-Type: application/vnd.android.package-archive",
            "Content-Length: " . filesize($filePath),
            "User-Agent: PHP"
        ]
    );
    return json_decode($response['result'], true);
}

// Rotar APKs: mantener solo 2
function rotateAssets($releaseData, $owner, $repo, $token) {
    $assets = $releaseData['assets'] ?? [];
    if (count($assets) > 1) {
        usort($assets, fn($a,$b) => strtotime($a['created_at']) - strtotime($b['created_at']));
        while(count($assets) > 2) {
            $oldest = array_shift($assets);
            githubRequest(
                "https://api.github.com/repos/$owner/$repo/releases/assets/".$oldest['id'],
                'DELETE',
                null,
                ["Authorization: token $token", "User-Agent: PHP"]
            );
        }
    }
}

// ==================== PROCESO DEL FORMULARIO ====================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $versionCode = intval($_POST['versionCode'] ?? 0);
    $versionName = htmlspecialchars($_POST['versionName'] ?? '');
    $agregados = htmlspecialchars($_POST['agregados'] ?? '');
    $correcciones = htmlspecialchars($_POST['correcciones'] ?? '');

    if (isset($_FILES['apkFile']) && $_FILES['apkFile']['error'] === UPLOAD_ERR_OK) {
        $tmpPath = $_FILES['apkFile']['tmp_name'];
        $ext = pathinfo($_FILES['apkFile']['name'], PATHINFO_EXTENSION);

        if (strtolower($ext) !== 'apk') {
            $message = "❌ Solo se permiten archivos APK.";
        } else {
            $tmpName = pathinfo($_FILES['apkFile']['name'], PATHINFO_FILENAME);
            $newFile = __DIR__ . '/' . $tmpName . '_' . time() . '.apk';
            move_uploaded_file($tmpPath, $newFile);

            // Obtener release
            $releaseData = getRelease($owner, $repo, $releaseTag, $githubToken);
            if (!$releaseData || !isset($releaseData['id'])) {
                $message = "❌ No se encontró el release con tag $releaseTag. Crea primero el release.";
            } else {
                // Subir APK
                $upload = uploadAsset($owner, $repo, $releaseData, $newFile, $githubToken);
                if (isset($upload['browser_download_url'])) {
                    $downloadUrl = $upload['browser_download_url'];

                    // Rotar últimos 2 APKs
                    rotateAssets($releaseData, $owner, $repo, $githubToken);

                    // Guardar version.json
                    $jsonData = [
                        'versionCode' => $versionCode,
                        'versionName' => $versionName,
                        'downloadUrl' => $downloadUrl,
                        'agregados' => $agregados,
                        'correcciones' => $correcciones
                    ];
                    file_put_contents('version.json', json_encode($jsonData, JSON_PRETTY_PRINT));
                    $message = "✅ APK subida correctamente y version.json actualizado.";
                    
                    // Borrar archivo temporal local
                    unlink($newFile);
                } else {
                    $message = "❌ Error al subir el APK a GitHub Release.";
                }
            }
        }
    } else {
        $message = "❌ No se detectó ningún archivo para subir o hubo un error.";
    }
}
?>

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Subir APK a GitHub Releases</title>
<style>
body { font-family: 'Segoe UI', sans-serif; background: #f0f2f5; display:flex; justify-content:center; align-items:center; min-height:100vh; margin:0; }
.container { background:#fff; padding:30px 40px; border-radius:12px; box-shadow:0 4px 20px rgba(0,0,0,0.1); width:100%; max-width:500px; text-align:center; }
h2 { color:#333; margin-bottom:10px; }
.notice { background:#fff3cd; color:#856404; border:1px solid #ffeeba; padding:10px; border-radius:6px; margin-bottom:20px; font-size:14px; }
input, textarea { width:100%; padding:10px 12px; margin:10px 0 20px 0; border:1px solid #ccc; border-radius:6px; font-size:14px; }
textarea { resize:vertical; min-height:60px; }
button { background:#4CAF50; color:white; padding:12px 20px; border:none; border-radius:6px; cursor:pointer; font-size:16px; transition:0.3s; }
button:hover { background:#45a049; }
.message { margin-top:20px; font-weight:bold; }
</style>
</head>
<body>
<div class="container">
<h2>Subir nueva versión APK</h2>
<div class="notice"><?= $notice ?></div>
<form action="" method="post" enctype="multipart/form-data">
    <input type="number" name="versionCode" placeholder="Código de versión" required>
    <input type="text" name="versionName" placeholder="Nombre de versión" required>
    <textarea name="agregados" placeholder="Agregados"></textarea>
    <textarea name="correcciones" placeholder="Correcciones"></textarea>
    <input type="file" name="apkFile" accept=".apk" required>
    <button type="submit">Subir APK</button>
</form>
<?php if($message) echo "<div class='message'>$message</div>"; ?>
</div>
</body>
</html>
