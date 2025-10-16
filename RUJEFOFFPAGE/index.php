<?php
$message = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $versionCode = intval($_POST['versionCode']);
    $versionName = htmlspecialchars($_POST['versionName']);
    $agregados = htmlspecialchars($_POST['agregados']);
    $correcciones = htmlspecialchars($_POST['correcciones']);

    if (isset($_FILES['apkFile']) && $_FILES['apkFile']['error'] === UPLOAD_ERR_OK) {
        $fileTmpPath = $_FILES['apkFile']['tmp_name'];
        $fileName = $_FILES['apkFile']['name'];
        $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);

        // Validar extensión
        if (strtolower($fileExtension) !== 'apk') {
            $message = "❌ Solo se permiten archivos APK.";
        } else {
            // Renombrar archivo para evitar conflictos
            $newFileName = 'app_' . time() . '.' . $fileExtension;
            $filePath = __DIR__ . '/' . $newFileName; // se guarda en la misma carpeta que el script

            if (move_uploaded_file($fileTmpPath, $filePath)) {
                // Crear o actualizar version.json
                $jsonData = [
                    'versionCode' => $versionCode,
                    'versionName' => $versionName,
                    'downloadUrl' => (isset($_SERVER['HTTPS']) ? "https" : "http") . "://{$_SERVER['HTTP_HOST']}/{$newFileName}",
                    'agregados' => $agregados,
                    'correcciones' => $correcciones
                ];

                file_put_contents('version.json', json_encode($jsonData, JSON_PRETTY_PRINT));
                $message = "✅ APK subida correctamente. Última versión actualizada.";
            } else {
                $message = "❌ Error al mover el archivo.";
            }
        }
    } else {
        $message = "❌ Error al subir el APK.";
    }
}
?>
