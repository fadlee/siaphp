# siaphp

Deploy project PHP ke shared hosting tanpa SSH.

`siaphp` adalah CLI npm kecil yang mengemas source code menjadi ZIP, menandatangani
request dengan HMAC, lalu mengirimkannya ke satu file agent PHP di hosting.

> Status: MVP v0.1. Gunakan dahulu pada proyek non-kritis dan simpan backup hosting.

## Kebutuhan

- Node.js 20 atau lebih baru di komputer lokal
- PHP 8.0 atau lebih baru di hosting
- Ekstensi PHP `ZipArchive`
- HTTPS dan akses tulis PHP ke folder tujuan

## Mulai

Jalankan dari root project PHP:

```bash
npx siaphp init
```

Wizard akan:

1. Memilih struktur `index.php` di root atau `public/index.php`.
2. Membuat `.siaphp/siaphp-agent.php` dengan secret unik.
3. Meminta agent tersebut di-upload ke hosting.
4. Menyimpan URL agent di `siaphp.json`.
5. Menyimpan secret lokal di `.siaphp/credentials.json`.

Setelah agent di-upload:

```bash
npx siaphp doctor
npx siaphp deploy
```

Untuk melihat isi paket deploy tanpa mengunggah:

```bash
npx siaphp deploy --dry-run
unzip -l .siaphp/siaphp-dry-run.zip
```

## Penempatan agent

### Flat

Untuk proyek dengan `index.php` di root, upload agent ke folder yang sama:

```text
public_html/
  index.php
  siaphp-agent.php
```

### Public folder

Untuk proyek dengan `public/index.php`, document root domain harus mengarah ke
folder `public`. Upload agent ke folder tersebut:

```text
project/
  app/
  public/
    index.php
    siaphp-agent.php
```

Agent akan memasang release ke folder `project`, satu tingkat di atas `public`.

## Konfigurasi

Contoh `siaphp.json`:

```json
{
  "schemaVersion": 1,
  "agentUrl": "https://example.com/siaphp-agent.php",
  "structure": "public",
  "entrypoint": "public/index.php",
  "exclude": [
    ".git",
    ".git/**",
    ".siaphp",
    ".siaphp/**",
    ".env",
    ".env.*",
    "node_modules",
    "node_modules/**",
    "siaphp.json"
  ]
}
```

Sesuaikan `exclude` bila project memerlukan file lain. Folder `vendor` sengaja
tidak dikecualikan karena banyak shared hosting tidak menyediakan Composer.

## Keamanan

- Setiap request memakai HMAC SHA-256, timestamp, dan nonce sekali pakai.
- Hash archive ikut ditandatangani dan diverifikasi setelah upload.
- Agent menolak path traversal, symlink, archive berlebihan, dan deploy paralel.
- `.env`, `.git`, konfigurasi lokal, dan credentials dikecualikan secara default.
- Secret hanya berada di agent dan `.siaphp/credentials.json`.

Jangan commit folder `.siaphp`. Hapus agent dari hosting bila siaphp tidak lagi
digunakan.

## Batasan MVP

- Deploy menambah dan mengganti file, tetapi belum menghapus file lama.
- Belum ada atomic release, rollback, shared directory, migration, atau build hook.
- Agent mengandalkan batas `upload_max_filesize` dan `post_max_size` dari hosting.
- Penggantian beberapa file tidak bersifat transaksional. Backup tetap diperlukan.

## Mode non-interaktif

```bash
npx siaphp init \
  --structure public \
  --agent-url https://example.com/siaphp-agent.php \
  --yes
```

Gunakan `--skip-check` bila agent belum di-upload. Setelah upload selesai,
jalankan `npx siaphp doctor`.

## Lisensi

MIT
