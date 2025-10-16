<?php
$message = '';
$notice = "⚠️ Recuerda: esta página es para subir nuevas versiones APK. Cada vez que se actualiza la página, asegúrate de revisar los datos antes de subir un archivo.";

// Configuración de PHP temporal para archivos grandes (si el hosting lo permite)
ini_set('upload_max_filesize', '50M');
ini_set('post_max_size', '50M');
ini_set('max_execution_time', '300');

$uploadDir = __DIR__ . '/uploads/'; // Carpeta de subida

// Crear carpeta uploads si no existe
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0755, true);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $versionCode = intval($_POST['versionCode']);
    $versionName = htmlspecialchars($_POST['versionName']);
    $agregados = htmlspecialchars($_POST['agregados']);
    $correcciones = htmlspecialchars($_POST['correcciones']);

    if (isset($_FILES['apkFile'])) {
        $fileError = $_FILES['apkFile']['error'];

        if ($fileError === UPLOAD_ERR_OK) {
            $fileTmpPath = $_FILES['apkFile']['tmp_name'];
            $fileName = $_FILES['apkFile']['name'];
            $fileExtension = pathinfo($fileName, PATHINFO_EXTENSION);

            if (strtolower($fileExtension) !== 'apk') {
                $message = "❌ Solo se permiten archivos APK.";
            } else {
                // Renombrar archivo
                $newFileName = 'app_' . time() . '.' . $fileExtension;
                $filePath = $uploadDir . $newFileName;

                if (move_uploaded_file($fileTmpPath, $filePath)) {
                    // Crear o actualizar version.json
                    $jsonData = [
                        'versionCode' => $versionCode,
                        'versionName' => $versionName,
                        'downloadUrl' => (isset($_SERVER['HTTPS']) ? "https" : "http") . "://{$_SERVER['HTTP_HOST']}/uploads/{$newFileName}",
                        'agregados' => $agregados,
                        'correcciones' => $correcciones
                    ];

                    file_put_contents('version.json', json_encode($jsonData, JSON_PRETTY_PRINT));
                    $message = "✅ APK subida correctamente. Última versión actualizada.";
                } else {
                    $message = "❌ Error al mover el archivo a la carpeta uploads. Verifica permisos de escritura.";
                }
            }
        } else {
            // Mostrar el código de error
            $message = "❌ Error al subir APK. Código de error: $fileError";

            // Interpretación de errores comunes
            switch ($fileError) {
                case UPLOAD_ERR_INI_SIZE:
                case UPLOAD_ERR_FORM_SIZE:
                    $message .= " (Archivo demasiado grande)";
                    break;
                case UPLOAD_ERR_PARTIAL:
                    $message .= " (Subida parcial del archivo)";
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $message .= " (No se subió ningún archivo)";
                    break;
                case UPLOAD_ERR_NO_TMP_DIR:
                    $message .= " (Falta carpeta temporal en el servidor)";
                    break;
                case UPLOAD_ERR_CANT_WRITE:
                    $message .= " (No se pudo escribir el archivo en el servidor)";
                    break;
                case UPLOAD_ERR_EXTENSION:
                    $message .= " (Extensión PHP bloqueó la subida)";
                    break;
            }
        }
    } else {
        $message = "❌ No se detectó ningún archivo para subir.";
    }
}
?>

<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Panel de Actualización APK</title>
<style>
    body {
        font-family: 'Segoe UI', sans-serif;
        background: #f0f2f5;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        margin: 0;
    }
    .container {
        background: #fff;
        padding: 30px 40px;
        border-radius: 12px;
        box-shadow: 0 4px 20px rgba(0,0,0,0.1);
        width: 100%;
        max-width: 500px;
        text-align: center;
    }
    h2 {
        color: #333;
        margin-bottom: 10px;
    }
    .notice {
        background: #fff3cd;
        color: #856404;
        border: 1px solid #ffeeba;
        padding: 10px;
        border-radius: 6px;
        margin-bottom: 20px;
        font-size: 14px;
    }
    input[type="number"], input[type="text"], input[type="file"], textarea {
        width: 100%;
        padding: 10px 12px;
        margin: 10px 0 20px 0;
        border: 1px solid #ccc;
        border-radius: 6px;
        font-size: 14px;
    }
    textarea {
        resize: vertical;
        min-height: 60px;
    }
    button {
        background: #4CAF50;
        color: white;
        padding: 12px 20px;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        transition: 0.3s;
    }
    button:hover {
        background: #45a049;
    }
    .message {
        margin-top: 20px;
        font-weight: bold;
    }
</style>
</head>
<body>

<div class="container">
    <h2>Subir nueva versión APK</h2>
    <div class="notice"><?= $notice ?></div>

    <form action="" method="post" enctype="multipart/form-data">
        <input type="number" name="versionCode" placeholder="Código de versión (número)" required>
        <input type="text" name="versionName" placeholder="Nombre de versión (ej: 1.0.5)" required>
        <textarea name="agregados" placeholder="Agregados en esta versión"></textarea>
        <textarea name="correcciones" placeholder="Correcciones en esta versión"></textarea>
        <input type="file" name="apkFile" accept=".apk" required>
        <button type="submit">Subir APK</button>
    </form>

    <?php if($message): ?>
        <div class="message"><?= $message ?></div>
    <?php endif; ?>
</div>

</body>
</html>
