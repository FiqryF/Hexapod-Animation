# Hexapod 18 Servo

Hexapod 18 Servo adalah animasi 3D interaktif yang berjalan di browser. Animasi ini memperlihatkan pola jalan robot berkaki enam dan menghitung sudut 18 sendi virtual dengan kinematika terbalik (*inverse kinematics*). Semua gerakan dan pembacaan sudut berasal dari simulasi di browser. Proyek ini tidak terhubung ke robot, servo, atau sensor fisik.

## Cara menjalankan

Buka [`index.html`](index.html) di browser yang mendukung WebGL. Koneksi internet diperlukan untuk memuat Three.js, Tailwind CSS, ikon, dan font dari CDN. Halaman dapat dibuka langsung tanpa instalasi atau proses build.

## Kontrol

| Tombol | Gerakan |
| --- | --- |
| `W` / `↑` dan `S` / `↓` | Maju dan mundur |
| `A` dan `D` | Geser ke kiri dan kanan |
| `Q` / `←` dan `E` / `→` | Putar ke kiri dan kanan |

Tahan tombol arah di layar untuk menggerakkan model, atau pilih **AUTO MAJU** untuk menjalankan animasi maju otomatis.

Di panel **Parameter Robot**, kamu bisa memilih pola langkah dan medan, serta mengatur postur, kecepatan, dan tinggi angkatan kaki. Panel **Telemetri 18 Servo** menampilkan sudut sendi model selama animasi.
