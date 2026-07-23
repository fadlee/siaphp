<?php
declare(strict_types=1);

/*
 * siaphp agent v0.1.0
 * Generated for one project. Do not commit or share this file.
 */

const SIAPHP_SECRET = '__SIAPHP_SECRET__';
const SIAPHP_MAX_UPLOAD_BYTES = __SIAPHP_MAX_UPLOAD_BYTES__;
const SIAPHP_MAX_EXTRACTED_BYTES = 536870912;
const SIAPHP_MAX_FILES = 10000;
const SIAPHP_CLOCK_TOLERANCE = 300;

$targetRoot = __SIAPHP_TARGET_ROOT__;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

set_exception_handler(static function (Throwable $error): void {
    respond(500, ['ok' => false, 'error' => 'Agent error: ' . $error->getMessage()]);
});

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['ok' => false, 'error' => 'Method not allowed.']);
}

$contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
if ($contentLength > SIAPHP_MAX_UPLOAD_BYTES + 1048576) {
    respond(413, ['ok' => false, 'error' => 'Archive melebihi batas upload agent.']);
}

$contentType = (string) ($_SERVER['CONTENT_TYPE'] ?? '');
$input = [];
if (str_contains($contentType, 'application/json')) {
    $decoded = json_decode((string) file_get_contents('php://input'), true);
    $input = is_array($decoded) ? $decoded : [];
} else {
    $input = $_POST;
}

$action = (string) ($input['action'] ?? '');
$payloadHash = $action === 'deploy'
    ? strtolower((string) ($input['archiveHash'] ?? ''))
    : hash('sha256', '');

authenticate($action, $payloadHash);

if ($action === 'doctor') {
    respond(200, [
        'ok' => true,
        'agentVersion' => '0.1.0',
        'phpVersion' => PHP_VERSION,
        'zipArchive' => class_exists('ZipArchive'),
        'targetWritable' => is_dir($targetRoot) && is_writable($targetRoot),
        'maxUploadBytes' => SIAPHP_MAX_UPLOAD_BYTES,
    ]);
}

if ($action !== 'deploy') {
    respond(400, ['ok' => false, 'error' => 'Action tidak dikenal.']);
}

deploy($targetRoot, $payloadHash);

function authenticate(string $action, string $payloadHash): void
{
    if (!in_array($action, ['doctor', 'deploy'], true)) {
        respond(400, ['ok' => false, 'error' => 'Action tidak dikenal.']);
    }

    if (!preg_match('/^[a-f0-9]{64}$/', $payloadHash)) {
        respond(400, ['ok' => false, 'error' => 'Payload hash tidak valid.']);
    }

    $timestamp = requestHeader('X-Siaphp-Timestamp');
    $nonce = requestHeader('X-Siaphp-Nonce');
    $signature = requestHeader('X-Siaphp-Signature');

    if (!ctype_digit($timestamp) || abs(time() - (int) $timestamp) > SIAPHP_CLOCK_TOLERANCE) {
        respond(401, ['ok' => false, 'error' => 'Timestamp request tidak valid.']);
    }

    if (!preg_match('/^[a-f0-9-]{36}$/i', $nonce)) {
        respond(401, ['ok' => false, 'error' => 'Nonce request tidak valid.']);
    }

    $canonical = implode("\n", [$timestamp, $nonce, $action, $payloadHash]);
    $expected = hash_hmac('sha256', $canonical, SIAPHP_SECRET);

    if (!hash_equals($expected, strtolower($signature))) {
        respond(401, ['ok' => false, 'error' => 'Signature request tidak valid.']);
    }

    rememberNonce($nonce, (int) $timestamp);
}

function rememberNonce(string $nonce, int $timestamp): void
{
    $file = sys_get_temp_dir() . '/siaphp-' . hash('sha256', __FILE__) . '.nonces';
    $handle = fopen($file, 'c+');
    if ($handle === false || !flock($handle, LOCK_EX)) {
        respond(500, ['ok' => false, 'error' => 'Agent tidak dapat mengunci nonce store.']);
    }

    $contents = stream_get_contents($handle);
    $nonces = json_decode($contents ?: '{}', true);
    $nonces = is_array($nonces) ? $nonces : [];

    foreach ($nonces as $storedNonce => $storedAt) {
        if ((int) $storedAt < time() - (SIAPHP_CLOCK_TOLERANCE * 2)) {
            unset($nonces[$storedNonce]);
        }
    }

    if (isset($nonces[$nonce])) {
        flock($handle, LOCK_UN);
        fclose($handle);
        respond(409, ['ok' => false, 'error' => 'Request sudah pernah digunakan.']);
    }

    $nonces[$nonce] = $timestamp;
    ftruncate($handle, 0);
    rewind($handle);
    fwrite($handle, json_encode($nonces, JSON_THROW_ON_ERROR));
    fflush($handle);
    flock($handle, LOCK_UN);
    fclose($handle);
}

function deploy(string $targetRoot, string $archiveHash): void
{
    if (!class_exists('ZipArchive')) {
        respond(503, ['ok' => false, 'error' => 'Ekstensi PHP ZipArchive belum aktif.']);
    }
    if (!is_dir($targetRoot) || !is_writable($targetRoot)) {
        respond(503, ['ok' => false, 'error' => 'Folder target tidak dapat ditulis oleh PHP.']);
    }
    if (!isset($_FILES['archive']) || !is_uploaded_file($_FILES['archive']['tmp_name'])) {
        respond(400, ['ok' => false, 'error' => 'Archive deploy tidak ditemukan.']);
    }
    if ((int) $_FILES['archive']['error'] !== UPLOAD_ERR_OK) {
        respond(400, ['ok' => false, 'error' => 'Upload archive gagal dengan kode ' . $_FILES['archive']['error'] . '.']);
    }
    if ((int) $_FILES['archive']['size'] > SIAPHP_MAX_UPLOAD_BYTES) {
        respond(413, ['ok' => false, 'error' => 'Archive melebihi batas upload agent.']);
    }

    $uploadedFile = (string) $_FILES['archive']['tmp_name'];
    if (!hash_equals($archiveHash, hash_file('sha256', $uploadedFile))) {
        respond(400, ['ok' => false, 'error' => 'Checksum archive tidak cocok.']);
    }

    $lockFile = sys_get_temp_dir() . '/siaphp-' . hash('sha256', __FILE__) . '.lock';
    $lock = fopen($lockFile, 'c');
    if ($lock === false || !flock($lock, LOCK_EX | LOCK_NB)) {
        respond(409, ['ok' => false, 'error' => 'Deploy lain masih berjalan.']);
    }

    $staging = sys_get_temp_dir() . '/siaphp-release-' . bin2hex(random_bytes(8));
    if (!mkdir($staging, 0700, true) && !is_dir($staging)) {
        throw new RuntimeException('Tidak dapat membuat staging directory.');
    }

    $release = '';
    $deployedFiles = 0;

    try {
        $zip = new ZipArchive();
        if ($zip->open($uploadedFile) !== true) {
            throw new RuntimeException('Archive ZIP tidak dapat dibuka.');
        }

        validateArchive($zip);
        if (!$zip->extractTo($staging)) {
            $zip->close();
            throw new RuntimeException('Archive ZIP tidak dapat diekstrak.');
        }
        $zip->close();

        $deployedFiles = copyRelease($staging, $targetRoot);
        $release = gmdate('Ymd-His') . '-' . substr($archiveHash, 0, 8);
    } finally {
        removeTree($staging);
        flock($lock, LOCK_UN);
        fclose($lock);
    }

    respond(200, [
        'ok' => true,
        'release' => $release,
        'deployedFiles' => $deployedFiles,
    ]);
}

function validateArchive(ZipArchive $zip): void
{
    if ($zip->numFiles > SIAPHP_MAX_FILES) {
        throw new RuntimeException('Archive berisi terlalu banyak file.');
    }

    $totalBytes = 0;
    for ($index = 0; $index < $zip->numFiles; $index++) {
        $stat = $zip->statIndex($index);
        if (!is_array($stat)) {
            throw new RuntimeException('Metadata archive tidak dapat dibaca.');
        }

        $name = str_replace('\\', '/', (string) $stat['name']);
        $parts = explode('/', $name);
        if (
            $name === ''
            || str_starts_with($name, '/')
            || preg_match('/^[A-Za-z]:\//', $name)
            || in_array('..', $parts, true)
            || str_contains($name, "\0")
        ) {
            throw new RuntimeException('Archive memiliki path yang tidak aman.');
        }

        $totalBytes += (int) ($stat['size'] ?? 0);
        if ($totalBytes > SIAPHP_MAX_EXTRACTED_BYTES) {
            throw new RuntimeException('Ukuran hasil ekstraksi melewati batas agent.');
        }
    }
}

function copyRelease(string $source, string $target): int
{
    $count = 0;
    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($source, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );

    foreach ($iterator as $item) {
        if ($item->isLink()) {
            throw new RuntimeException('Symlink di dalam archive tidak diizinkan.');
        }

        $relative = substr($item->getPathname(), strlen($source) + 1);
        $destination = $target . DIRECTORY_SEPARATOR . $relative;

        if ($item->isDir()) {
            if (!is_dir($destination) && !mkdir($destination, 0755, true) && !is_dir($destination)) {
                throw new RuntimeException('Tidak dapat membuat folder: ' . $relative);
            }
            continue;
        }

        $parent = dirname($destination);
        if (!is_dir($parent) && !mkdir($parent, 0755, true) && !is_dir($parent)) {
            throw new RuntimeException('Tidak dapat membuat folder target.');
        }
        if (!copy($item->getPathname(), $destination)) {
            throw new RuntimeException('Tidak dapat menulis file: ' . $relative);
        }
        $count++;
    }

    return $count;
}

function removeTree(string $directory): void
{
    if (!is_dir($directory)) {
        return;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );

    foreach ($iterator as $item) {
        $item->isDir() ? rmdir($item->getPathname()) : unlink($item->getPathname());
    }
    rmdir($directory);
}

function requestHeader(string $name): string
{
    $key = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
    return trim((string) ($_SERVER[$key] ?? ''));
}

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
