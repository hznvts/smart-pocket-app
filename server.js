const nodemailer = require("nodemailer");
const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const app = express();
const bcrypt = require("bcryptjs"); // Modul untuk enkripsi password
const PORT = process.env.PORT || 3000;

// Middleware agar server bisa membaca data JSON dari frontend
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Menyajikan folder 'public' agar file HTML, CSS, JS bisa diakses langsung
app.use(express.static(path.join(__dirname, "public")));

// 1. KONEKSI KE DATABASE MYSQL
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "stevenchang",
  database: process.env.DB_NAME || "smart_pocket",
  port: process.env.DB_PORT || 3306,
});

db.connect((err) => {
  if (err) {
    console.error("Gagal koneksi ke Database:", err);
  } else {
    console.log("Berhasil terhubung ke MySQL (Database: smart_pocket)");
  }
});

// --- API UNTUK DAFTAR AKUN (REGISTER) ---
app.post("/api/register", async (req, res) => {
  const { nama, email, password } = req.body;

  if (!nama || !email || !password) {
    return res
      .status(400)
      .json({ status: "error", message: "Mohon lengkapi semua data!" });
  }

  // 1. Cek apakah email sudah pernah didaftarkan
  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err)
        return res
          .status(500)
          .json({ status: "error", message: "Database error" });
      if (results.length > 0)
        return res
          .status(400)
          .json({ status: "error", message: "Email sudah terdaftar!" });

      try {
        // 2. Enkripsi Password (Hashing) dengan tingkat kesulitan 10
        const hashedPassword = await bcrypt.hash(password, 10);

        // 3. Simpan ke database
        db.query(
          "INSERT INTO users (nama, email, password) VALUES (?, ?, ?)",
          [nama, email, hashedPassword],
          (errInsert, result) => {
            if (errInsert)
              return res
                .status(500)
                .json({ status: "error", message: "Gagal mendaftar" });
            res.status(200).json({
              status: "success",
              message: "Pendaftaran berhasil! Silakan login.",
            });
          },
        );
      } catch (error) {
        res
          .status(500)
          .json({ status: "error", message: "Terjadi kesalahan pada server" });
      }
    },
  );
});

// --- API UNTUK LOGIN ---
app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res
      .status(400)
      .json({ status: "error", message: "Email dan Password wajib diisi!" });
  }

  // 1. Cari user berdasarkan email di database
  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err)
        return res
          .status(500)
          .json({ status: "error", message: "Database error" });

      // Jika email tidak ditemukan
      if (results.length === 0) {
        return res
          .status(401)
          .json({ status: "error", message: "Email tidak ditemukan!" });
      }

      const user = results[0];

      // 2. Cocokkan password yang diketik dengan password acak di database
      const isPasswordMatch = await bcrypt.compare(password, user.password);

      if (!isPasswordMatch) {
        return res
          .status(401)
          .json({ status: "error", message: "Password salah!" });
      }

      // 3. Jika sukses, kirim data user ke Frontend
      res.status(200).json({
        status: "success",
        message: "Login berhasil",
        user: {
          id: user.id,
          nama: user.nama,
          email: user.email,
        },
      });
    },
  );
});

const { OAuth2Client } = require("google-auth-library");
// Nanti ganti string ini dengan Client ID asli Anda
const CLIENT_ID = "CLIENT_ID_GOOGLE_ANDA_DISINI";
const client = new OAuth2Client(CLIENT_ID);

// --- API UNTUK LOGIN GOOGLE ---
app.post("/api/google-login", async (req, res) => {
  const { token } = req.body;

  try {
    // Memverifikasi keaslian token langsung ke server Google
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: CLIENT_ID,
    });

    // Membongkar data user dari Google
    const payload = ticket.getPayload();
    const userEmail = payload["email"];
    const userName = payload["name"];
    const userPicture = payload["picture"]; // Bisa dipakai untuk foto profil nanti

    console.log(
      `User berhasil login dengan Google: ${userName} (${userEmail})`,
    );

    // Sukses! Beri tahu frontend untuk pindah halaman
    res.json({
      status: "success",
      message: "Login Google berhasil",
      user: { name: userName, email: userEmail, picture: userPicture },
    });
  } catch (error) {
    console.error("Verifikasi Google gagal:", error);
    res.json({
      status: "error",
      message: "Gagal memverifikasi akun Google.",
    });
  }
});

// --- API LUPA PASSWORD ---
app.post("/api/lupa-password", (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res
      .status(400)
      .json({ status: "error", message: "Email wajib diisi!" });
  }

  // 1. Cek apakah email terdaftar di database
  db.query(
    "SELECT * FROM users WHERE email = ?",
    [email],
    async (err, results) => {
      if (err)
        return res
          .status(500)
          .json({ status: "error", message: "Database error" });
      if (results.length === 0)
        return res
          .status(404)
          .json({ status: "error", message: "Email tidak terdaftar!" });

      // 2. Buat password sementara (Acak 6 karakter)
      const tempPassword = Math.random().toString(36).slice(-6);

      // 3. Hash password sementara tersebut
      const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

      // 4. Update database dengan password baru
      db.query(
        "UPDATE users SET password = ? WHERE email = ?",
        [hashedTempPassword, email],
        async (errUpdate) => {
          if (errUpdate)
            return res
              .status(500)
              .json({ status: "error", message: "Gagal mereset password" });

          // 5. Kirim email menggunakan Nodemailer (Mode Spesifik & Aman)
          const transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
              user: "smartpocket.id@gmail.com",
              pass: "rsjr atbl oyaz krkr",
            },
          });

          const mailOptions = {
            from: '"Smart Pocket Support" <smartpocket.id@gmail.com>',
            to: email,
            subject: "Reset Password - Smart Pocket",
            html: `
          <h3>Halo</h3>
          <p>Kami menerima permintaan untuk mengatur ulang password akun Anda di Smart Pocket.</p>
          <p>Silahkan gunakan password sementara di bawah ini:</p>
          <h2 style="color: #0d6efd;">${tempPassword}</h2>
          <p>Silakan login menggunakan password di atas, dan <b>segera ubah password Anda</b> di menu Edit Profil demi keamanan.</p>
          <br>
          <p>Salam hangat,<br>Tim Smart Pocket</p>
        `,
          };

          try {
            await transporter.sendMail(mailOptions);
            res.status(200).json({
              status: "success",
              message: "Password sementara telah dikirim ke email Anda!",
            });
          } catch (mailErr) {
            console.error("Error kirim email:", mailErr);
            res.status(500).json({
              status: "error",
              message: "Gagal mengirim email. Pastikan email anda benar.",
            });
          }
        },
      );
    },
  );
});

// ==========================================
// API ROUTES UNTUK FITUR PEMASUKAN
// ==========================================

// 1. Menyimpan Pemasukan Baru (POST) & Menambah Saldo Tabungan
app.post("/api/pemasukan", (req, res) => {
  const {
    tanggal,
    sumber_pemasukan,
    nominal_pemasukan,
    id_tabungan,
    keterangan,
  } = req.body;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  // Langkah A: Menyimpan riwayat pemasukan
  const sqlInsert =
    "INSERT INTO pemasukan (user_id, tanggal, sumber, nominal, id_tabungan, keterangan) VALUES (?, ?, ?, ?, ?, ?)";

  db.query(
    sqlInsert,
    [
      userId,
      tanggal,
      sumber_pemasukan,
      nominal_pemasukan,
      id_tabungan,
      keterangan,
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({ error: "Gagal menyimpan data pemasukan" });
      }

      // Langkah B: Menambahkan saldo ke tabel tabungan yang dipilih
      // Jika user memilih tabungan (id_tabungan tidak kosong)
      if (id_tabungan) {
        const sqlUpdateSaldo =
          "UPDATE tabungan SET saldo = saldo + ? WHERE id = ? AND user_id = ?";
        db.query(
          sqlUpdateSaldo,
          [nominal_pemasukan, id_tabungan, userId],
          (errUpdate, resultUpdate) => {
            if (errUpdate) {
              console.error("Gagal update saldo:", errUpdate);
              // Catatan: Walau gagal update saldo, riwayat tetap tersimpan. Di sistem nyata butuh fitur "Transaction".
            }
            res
              .status(200)
              .json({ message: "Pemasukan dicatat & Saldo ditambahkan!" });
          },
        );
      } else {
        // Jika tidak memilih tabungan, simpan riwayatnya saja
        res.status(200).json({ message: "Pemasukan berhasil dicatat!" });
      }
    },
  );
});

// 2. Mengambil Riwayat Pemasukan (GET) dengan JOIN ke tabel Tabungan (Filter Bulan Berjalan)
app.get("/api/pemasukan", (req, res) => {
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  // Mengambil angka bulan dan tahun saat ini dari sistem
  const bulanSaatIni = new Date().getMonth() + 1;
  const tahunSaatIni = new Date().getFullYear();

  // Menambahkan filter MONTH() dan YEAR() pada query SQL
  const sql = `
        SELECT p.*, t.nama_bank 
        FROM pemasukan p 
        LEFT JOIN tabungan t ON p.id_tabungan = t.id 
        WHERE p.user_id = ? AND MONTH(p.tanggal) = ? AND YEAR(p.tanggal) = ?
        ORDER BY p.tanggal DESC
    `;

  // Masukkan variabel bulan dan tahun ke dalam array parameter
  db.query(sql, [userId, bulanSaatIni, tahunSaatIni], (err, results) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Gagal mengambil data" });
    }
    res.status(200).json(results);
  });
});

// API 3: Menghapus Pemasukan (DELETE)
app.delete("/api/pemasukan/:id", (req, res) => {
  const idPemasukan = req.params.id;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  const sql = "DELETE FROM pemasukan WHERE id = ? AND user_id = ?";
  db.query(sql, [idPemasukan, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Gagal menghapus data" });
    }
    res.status(200).json({ message: "Data berhasil dihapus!" });
  });
});

// API 4: Mengupdate Pemasukan (PUT)
app.put("/api/pemasukan/:id", (req, res) => {
  const idPemasukan = req.params.id;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }
  const { tanggal, sumber_pemasukan, nominal_pemasukan, keterangan } = req.body;

  const sql =
    "UPDATE pemasukan SET tanggal = ?, sumber = ?, nominal = ?, keterangan = ? WHERE id = ? AND user_id = ?";
  db.query(
    sql,
    [
      tanggal,
      sumber_pemasukan,
      nominal_pemasukan,
      keterangan,
      idPemasukan,
      userId,
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Gagal mengupdate data" });
      }
      res.status(200).json({ message: "Data berhasil diupdate!" });
    },
  );
});

// ==========================================
// API ROUTES UNTUK FITUR PENGELUARAN
// ==========================================

// 1. Menyimpan Pengeluaran Baru (POST) & Mengurangi Saldo
app.post("/api/pengeluaran", (req, res) => {
  const {
    tanggal,
    kategori_pengeluaran,
    nominal_pengeluaran,
    id_tabungan,
    keterangan,
  } = req.body;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  // A. Simpan riwayat pengeluaran
  const sqlInsert =
    "INSERT INTO pengeluaran (user_id, tanggal, kategori, nominal, id_tabungan, keterangan) VALUES (?, ?, ?, ?, ?, ?)";
  db.query(
    sqlInsert,
    [
      userId,
      tanggal,
      kategori_pengeluaran,
      nominal_pengeluaran,
      id_tabungan,
      keterangan,
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({ error: "Gagal menyimpan data pengeluaran" });
      }

      // B. Kurangi saldo tabungan yang dipilih (Perhatikan tanda minus "-")
      if (id_tabungan) {
        const sqlUpdateSaldo =
          "UPDATE tabungan SET saldo = saldo - ? WHERE id = ? AND user_id = ?";
        db.query(
          sqlUpdateSaldo,
          [nominal_pengeluaran, id_tabungan, userId],
          (errUpdate) => {
            if (errUpdate) console.error("Gagal update saldo:", errUpdate);
            res
              .status(200)
              .json({ message: "Pengeluaran dicatat & Saldo dikurangi!" });
          },
        );
      } else {
        res.status(200).json({ message: "Pengeluaran berhasil dicatat!" });
      }
    },
  );
});

// 2. Mengambil Riwayat Pengeluaran (GET) dengan JOIN Tabungan (Filter Bulan Berjalan)
app.get("/api/pengeluaran", (req, res) => {
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  // Mengambil angka bulan dan tahun saat ini dari sistem
  const bulanSaatIni = new Date().getMonth() + 1;
  const tahunSaatIni = new Date().getFullYear();

  // Menambahkan filter MONTH() dan YEAR() pada query SQL
  const sql = `
        SELECT p.*, t.nama_bank 
        FROM pengeluaran p 
        LEFT JOIN tabungan t ON p.id_tabungan = t.id 
        WHERE p.user_id = ? AND MONTH(p.tanggal) = ? AND YEAR(p.tanggal) = ?
        ORDER BY p.tanggal DESC
    `;

  // Masukkan variabel bulan dan tahun ke dalam array parameter
  db.query(sql, [userId, bulanSaatIni, tahunSaatIni], (err, results) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data" });
    res.status(200).json(results);
  });
});

// 3. Menghapus Pengeluaran (DELETE)
app.delete("/api/pengeluaran/:id", (req, res) => {
  const idPengeluaran = req.params.id;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  const sql = "DELETE FROM pengeluaran WHERE id = ? AND user_id = ?";
  db.query(sql, [idPengeluaran, userId], (err, result) => {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: "Gagal menghapus data" });
    }
    res.status(200).json({ message: "Data berhasil dihapus!" });
  });
});

// 4. Mengupdate Pengeluaran (PUT)
app.put("/api/pengeluaran/:id", (req, res) => {
  const idPengeluaran = req.params.id;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }
  const { tanggal, kategori_pengeluaran, nominal_pengeluaran, keterangan } =
    req.body;

  const sql =
    "UPDATE pengeluaran SET tanggal = ?, kategori = ?, nominal = ?, keterangan = ? WHERE id = ? AND user_id = ?";
  db.query(
    sql,
    [
      tanggal,
      kategori_pengeluaran,
      nominal_pengeluaran,
      keterangan,
      idPengeluaran,
      userId,
    ],
    (err, result) => {
      if (err) {
        console.error(err);
        return res.status(500).json({ error: "Gagal mengupdate data" });
      }
      res.status(200).json({ message: "Data berhasil diupdate!" });
    },
  );
});

// ==========================================
// API ROUTES UNTUK FITUR KATEGORI
// ==========================================

// 1. Menyimpan Kategori Baru (POST)
app.post("/api/kategori", (req, res) => {
  const { tipe_kategori, nama_kategori } = req.body;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  const sql = "INSERT INTO kategori (user_id, tipe, nama) VALUES (?, ?, ?)";
  db.query(sql, [userId, tipe_kategori, nama_kategori], (err, result) => {
    if (err) return res.status(500).json({ error: "Gagal menyimpan kategori" });
    res.status(200).json({ message: "Kategori berhasil ditambahkan!" });
  });
});

// 2. Mengambil Daftar Kategori (GET)
app.get("/api/kategori", (req, res) => {
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  const sql =
    "SELECT * FROM kategori WHERE user_id = ? ORDER BY tipe ASC, nama ASC";
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data" });
    res.status(200).json(results);
  });
});

// 3. Menghapus Kategori (DELETE)
app.delete("/api/kategori/:id", (req, res) => {
  const idKategori = req.params.id;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  const sql = "DELETE FROM kategori WHERE id = ? AND user_id = ?";
  db.query(sql, [idKategori, userId], (err, result) => {
    if (err) return res.status(500).json({ error: "Gagal menghapus kategori" });
    res.status(200).json({ message: "Kategori berhasil dihapus!" });
  });
});

// 4. Mengupdate Kategori (PUT)
app.put("/api/kategori/:id", (req, res) => {
  const idKategori = req.params.id;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }
  const { tipe_kategori, nama_kategori } = req.body;

  const sql =
    "UPDATE kategori SET tipe = ?, nama = ? WHERE id = ? AND user_id = ?";
  db.query(
    sql,
    [tipe_kategori, nama_kategori, idKategori, userId],
    (err, result) => {
      if (err)
        return res.status(500).json({ error: "Gagal mengupdate kategori" });
      res.status(200).json({ message: "Kategori berhasil diupdate!" });
    },
  );
});

// ==========================================
// API ROUTES UNTUK FITUR TABUNGAN (ASET)
// ==========================================

// 1. Menyimpan Tabungan Baru (POST)
app.post("/api/tabungan", (req, res) => {
  const { nama_bank, kategori_aset, saldo } = req.body;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  const sql =
    "INSERT INTO tabungan (user_id, nama_bank, kategori_aset, saldo) VALUES (?, ?, ?, ?)";
  db.query(sql, [userId, nama_bank, kategori_aset, saldo], (err, result) => {
    if (err)
      return res.status(500).json({ error: "Gagal menyimpan data tabungan" });
    res.status(200).json({ message: "Tabungan berhasil dicatat!" });
  });
});

// 2. Mengambil Daftar Tabungan (GET)
app.get("/api/tabungan", (req, res) => {
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  // Menampilkan tabungan yang saldonya paling besar terlebih dahulu
  const sql = "SELECT * FROM tabungan WHERE user_id = ? ORDER BY saldo DESC";
  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data" });
    res.status(200).json(results);
  });
});

// 3. Menghapus Tabungan (DELETE)
app.delete("/api/tabungan/:id", (req, res) => {
  const idTabungan = req.params.id;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  const sql = "DELETE FROM tabungan WHERE id = ? AND user_id = ?";
  db.query(sql, [idTabungan, userId], (err, result) => {
    if (err) return res.status(500).json({ error: "Gagal menghapus data" });
    res.status(200).json({ message: "Tabungan berhasil dihapus!" });
  });
});

// 4. Mengupdate Tabungan (PUT)
app.put("/api/tabungan/:id", (req, res) => {
  const idTabungan = req.params.id;
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }
  const { nama_bank, kategori_aset, saldo } = req.body;

  const sql =
    "UPDATE tabungan SET nama_bank = ?, kategori_aset = ?, saldo = ? WHERE id = ? AND user_id = ?";
  db.query(
    sql,
    [nama_bank, kategori_aset, saldo, idTabungan, userId],
    (err, result) => {
      if (err) return res.status(500).json({ error: "Gagal mengupdate data" });
      res.status(200).json({ message: "Tabungan berhasil diupdate!" });
    },
  );
});

// ==========================================
// API ROUTES UNTUK RIWAYAT TRANSAKSI (MUTASI)
// ==========================================

// Mengambil Riwayat Gabungan (Pemasukan & Pengeluaran) + Fitur Auto-Delete 3 Tahun
app.get("/api/riwayat", (req, res) => {
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }

  // --- 1. PROSES PEMBERSIHAN OTOMATIS (AUTO-DELETE) ---
  // MySQL akan otomatis mencari dan menghapus data yang tanggalnya kurang dari hari ini dikurangi 3 tahun
  const hapusPemasukan =
    "DELETE FROM pemasukan WHERE tanggal < DATE_SUB(CURDATE(), INTERVAL 3 YEAR) AND user_id = ?";
  const hapusPengeluaran =
    "DELETE FROM pengeluaran WHERE tanggal < DATE_SUB(CURDATE(), INTERVAL 3 YEAR) AND user_id = ?";

  // Eksekusi pembersihan (berjalan di background)
  db.query(hapusPemasukan, [userId], (err) => {
    if (err) console.error("Gagal auto-delete pemasukan:", err);
  });
  db.query(hapusPengeluaran, [userId], (err) => {
    if (err) console.error("Gagal auto-delete pengeluaran:", err);
  });

  // --- 2. PROSES MENGAMBIL DATA RIWAYAT ---
  const bulan = req.query.bulan || new Date().getMonth() + 1;
  const tahun = req.query.tahun || new Date().getFullYear();

  const sql = `
        SELECT id, tanggal, sumber AS kategori, nominal, keterangan, 'pemasukan' AS jenis 
        FROM pemasukan 
        WHERE user_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?
        
        UNION ALL
        
        SELECT id, tanggal, kategori, nominal, keterangan, 'pengeluaran' AS jenis 
        FROM pengeluaran 
        WHERE user_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?
        
        ORDER BY tanggal DESC
    `;

  db.query(
    sql,
    [userId, bulan, tahun, userId, bulan, tahun],
    (err, results) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({ error: "Gagal mengambil riwayat transaksi" });
      }
      res.status(200).json(results);
    },
  );
});

// ==========================================
// API ROUTES UNTUK DASHBOARD UTAMA
// ==========================================

app.get("/api/dashboard", (req, res) => {
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();

  // Query 1: Total Pemasukan Bulan Ini
  const qPemasukan =
    "SELECT COALESCE(SUM(nominal), 0) AS total FROM pemasukan WHERE user_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?";

  // Query 2: Total Pengeluaran Bulan Ini
  const qPengeluaran =
    "SELECT COALESCE(SUM(nominal), 0) AS total FROM pengeluaran WHERE user_id = ? AND MONTH(tanggal) = ? AND YEAR(tanggal) = ?";

  // Query 3: 5 Transaksi Terakhir (Gabungan Pemasukan & Pengeluaran)
  const qTransaksi = `
        SELECT tanggal, sumber AS kategori, keterangan, nominal, 'pemasukan' AS jenis 
        FROM pemasukan WHERE user_id = ?
        UNION ALL
        SELECT tanggal, kategori, keterangan, nominal, 'pengeluaran' AS jenis 
        FROM pengeluaran WHERE user_id = ?
        ORDER BY tanggal DESC LIMIT 5
    `;

  // Mengeksekusi query secara berurutan (Nested callbacks)
  db.query(qPemasukan, [userId, currentMonth, currentYear], (err1, resPem) => {
    if (err1)
      return res
        .status(500)
        .json({ error: "Gagal ambil data pemasukan dashboard" });

    db.query(
      qPengeluaran,
      [userId, currentMonth, currentYear],
      (err2, resPeng) => {
        if (err2)
          return res
            .status(500)
            .json({ error: "Gagal ambil data pengeluaran dashboard" });

        db.query(qTransaksi, [userId, userId], (err3, resTrans) => {
          if (err3)
            return res
              .status(500)
              .json({ error: "Gagal ambil data transaksi dashboard" });

          // Mengirimkan ke-3 data tersebut dalam satu paket JSON ke frontend
          res.status(200).json({
            total_pemasukan: resPem[0].total,
            total_pengeluaran: resPeng[0].total,
            transaksi_terakhir: resTrans,
          });
        });
      },
    );
  });
});

// ==========================================
// API ROUTES UNTUK FUZZY TSUKAMOTO (5 VARIABEL - 32 RULES SKRIPSI)
// Input: Pendapatan, Pengeluaran, Cicilan, Tanggungan, Status
// ==========================================

// 1. Mengambil Rekomendasi Terbaru Bulan Ini (GET)
app.get("/api/rekomendasi-terbaru", (req, res) => {
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }
  const bulan = new Date().getMonth() + 1;
  const tahun = new Date().getFullYear();

  const sql =
    "SELECT * FROM rekomendasi WHERE user_id = ? AND bulan = ? AND tahun = ?";
  db.query(sql, [userId, bulan, tahun], (err, results) => {
    if (err) return res.status(500).json({ error: "Gagal mengambil data" });

    if (results.length > 0) {
      res.status(200).json(results[0]);
    } else {
      res.status(404).json({ message: "Belum ada rekomendasi bulan ini" });
    }
  });
});

// 2. Menghitung dan Menyimpan Rekomendasi (POST)
app.post("/api/hitung-fuzzy", (req, res) => {
  let { pendapatan, pengeluaran, cicilan, tanggungan, status } = req.body;

  let P = parseFloat(pendapatan);
  let E = parseFloat(pengeluaran);
  let C = parseFloat(cicilan);
  let T = parseFloat(tanggungan);
  let S = parseInt(status); // 1 = Lajang, 2 = Menikah

  if (!P || P <= 0)
    return res.status(400).json({ error: "Pendapatan tidak valid" });

  // ========================================================
  // TAHAP 1: FUZZIFIKASI (Mencari Derajat Keanggotaan / Miu)
  // ========================================================

  // 1. Variabel Pendapatan (Rendah <= 3Jt, Tinggi >= 7Jt)
  let pRendah = 0,
    pTinggi = 0;
  if (P <= 3000000) {
    pRendah = 1;
    pTinggi = 0;
  } else if (P >= 7000000) {
    pRendah = 0;
    pTinggi = 1;
  } else {
    pRendah = (7000000 - P) / 4000000;
    pTinggi = (P - 3000000) / 4000000;
  }

  // 2. Variabel Pengeluaran Rutin (Hemat <= 2Jt, Boros >= 5Jt)
  let eHemat = 0,
    eBoros = 0;
  if (E <= 2000000) {
    eHemat = 1;
    eBoros = 0;
  } else if (E >= 5000000) {
    eHemat = 0;
    eBoros = 1;
  } else {
    eHemat = (5000000 - E) / 3000000;
    eBoros = (E - 2000000) / 3000000;
  }

  // 3. Variabel Cicilan (Sedikit <= 1Jt, Banyak >= 3Jt)
  let cSedikit = 0,
    cBanyak = 0;
  if (C <= 1000000) {
    cSedikit = 1;
    cBanyak = 0;
  } else if (C >= 3000000) {
    cSedikit = 0;
    cBanyak = 1;
  } else {
    cSedikit = (3000000 - C) / 2000000;
    cBanyak = (C - 1000000) / 2000000;
  }

  // 4. Variabel Tanggungan (Sedikit <= 1 Orang, Banyak >= 4 Orang)
  let tSedikit = 0,
    tBanyak = 0;
  if (T <= 1) {
    tSedikit = 1;
    tBanyak = 0;
  } else if (T >= 4) {
    tSedikit = 0;
    tBanyak = 1;
  } else {
    tSedikit = (4 - T) / 3;
    tBanyak = (T - 1) / 3;
  }

  // 5. Variabel Status Pernikahan (Singleton Fuzzification)
  // Karena ini variabel pasti (Crisp), nilainya mutlak 1 atau 0
  let sLajang = S === 1 ? 1 : 0;
  let sMenikah = S === 2 ? 1 : 0;

  // ========================================================
  // TAHAP 2: INFERENSI (32 Rule Base Tsukamoto)
  // ========================================================
  let alpha = [],
    zKeb = [],
    zKei = [],
    zTab = [];

  // FUNGSI IMPLIKASI OUTPUT
  // Kebutuhan: Min 40%, Max 75% (Selisih 35)
  const kebNaik = (a) => 40 + 35 * a;
  const kebTurun = (a) => 75 - 35 * a;

  // Keinginan & Tabungan: Min 10%, Max 30% (Selisih 20)
  const keiNaik = (a) => 10 + 20 * a;
  const keiTurun = (a) => 30 - 20 * a;
  const tabNaik = (a) => 10 + 20 * a;
  const tabTurun = (a) => 30 - 20 * a;

  // MATRIKS 32 ATURAN
  // Format Array: [Pendapatan, Pengeluaran, Cicilan, Tanggungan, Status, -> Fungsi Z Kebutuhan, Keinginan, Tabungan]
  const rules = [
    // --- KELOMPOK 1: STATUS LAJANG (16 Aturan) ---
    // Logika Lajang: Bisa lebih toleran terhadap "Keinginan" (Wants) jika keuangan sehat.
    [pRendah, eHemat, cSedikit, tSedikit, sLajang, kebTurun, keiNaik, tabNaik], // R1
    [pRendah, eHemat, cSedikit, tBanyak, sLajang, kebNaik, keiTurun, tabTurun], // R2
    [pRendah, eHemat, cBanyak, tSedikit, sLajang, kebNaik, keiTurun, tabTurun], // R3
    [pRendah, eHemat, cBanyak, tBanyak, sLajang, kebNaik, keiTurun, tabTurun], // R4
    [pRendah, eBoros, cSedikit, tSedikit, sLajang, kebNaik, keiTurun, tabTurun], // R5
    [pRendah, eBoros, cSedikit, tBanyak, sLajang, kebNaik, keiTurun, tabTurun], // R6
    [pRendah, eBoros, cBanyak, tSedikit, sLajang, kebNaik, keiTurun, tabTurun], // R7
    [pRendah, eBoros, cBanyak, tBanyak, sLajang, kebNaik, keiTurun, tabTurun], // R8
    [pTinggi, eHemat, cSedikit, tSedikit, sLajang, kebTurun, keiNaik, tabNaik], // R9
    [pTinggi, eHemat, cSedikit, tBanyak, sLajang, kebTurun, keiNaik, tabTurun], // R10
    [pTinggi, eHemat, cBanyak, tSedikit, sLajang, kebTurun, keiTurun, tabNaik], // R11
    [pTinggi, eHemat, cBanyak, tBanyak, sLajang, kebNaik, keiTurun, tabTurun], // R12
    [pTinggi, eBoros, cSedikit, tSedikit, sLajang, kebNaik, keiNaik, tabTurun], // R13
    [pTinggi, eBoros, cSedikit, tBanyak, sLajang, kebNaik, keiTurun, tabTurun], // R14
    [pTinggi, eBoros, cBanyak, tSedikit, sLajang, kebNaik, keiTurun, tabTurun], // R15
    [pTinggi, eBoros, cBanyak, tBanyak, sLajang, kebNaik, keiTurun, tabTurun], // R16

    // --- KELOMPOK 2: STATUS MENIKAH (16 Aturan) ---
    // Logika Menikah: "Kebutuhan" (Needs) otomatis lebih memprioritaskan "Tabungan", "Keinginan" sangat ditekan jika ada tanggungan.
    [pRendah, eHemat, cSedikit, tSedikit, sMenikah, kebNaik, keiTurun, tabNaik], // R17
    [pRendah, eHemat, cSedikit, tBanyak, sMenikah, kebNaik, keiTurun, tabTurun], // R18
    [pRendah, eHemat, cBanyak, tSedikit, sMenikah, kebNaik, keiTurun, tabTurun], // R19
    [pRendah, eHemat, cBanyak, tBanyak, sMenikah, kebNaik, keiTurun, tabTurun], // R20
    [
      pRendah,
      eBoros,
      cSedikit,
      tSedikit,
      sMenikah,
      kebNaik,
      keiTurun,
      tabTurun,
    ], // R21
    [pRendah, eBoros, cSedikit, tBanyak, sMenikah, kebNaik, keiTurun, tabTurun], // R22
    [pRendah, eBoros, cBanyak, tSedikit, sMenikah, kebNaik, keiTurun, tabTurun], // R23
    [pRendah, eBoros, cBanyak, tBanyak, sMenikah, kebNaik, keiTurun, tabTurun], // R24
    [
      pTinggi,
      eHemat,
      cSedikit,
      tSedikit,
      sMenikah,
      kebTurun,
      keiTurun,
      tabNaik,
    ], // R25
    [pTinggi, eHemat, cSedikit, tBanyak, sMenikah, kebNaik, keiTurun, tabNaik], // R26
    [pTinggi, eHemat, cBanyak, tSedikit, sMenikah, kebNaik, keiTurun, tabNaik], // R27
    [pTinggi, eHemat, cBanyak, tBanyak, sMenikah, kebNaik, keiTurun, tabTurun], // R28
    [pTinggi, eBoros, cSedikit, tSedikit, sMenikah, kebNaik, keiTurun, tabNaik], // R29
    [pTinggi, eBoros, cSedikit, tBanyak, sMenikah, kebNaik, keiTurun, tabTurun], // R30
    [pTinggi, eBoros, cBanyak, tSedikit, sMenikah, kebNaik, keiTurun, tabTurun], // R31
    [pTinggi, eBoros, cBanyak, tBanyak, sMenikah, kebNaik, keiTurun, tabTurun], // R32
  ];

  // Eksekusi Rule (Mencari Alpha Predikat dengan Operator AND / MIN)
  for (let i = 0; i < rules.length; i++) {
    // rules[i][4] adalah index status (Lajang/Menikah)
    let alphaVal = Math.min(
      rules[i][0],
      rules[i][1],
      rules[i][2],
      rules[i][3],
      rules[i][4],
    );

    if (alphaVal > 0) {
      alpha.push(alphaVal);
      zKeb.push(rules[i][5](alphaVal));
      zKei.push(rules[i][6](alphaVal));
      zTab.push(rules[i][7](alphaVal));
    }
  }

  // ========================================================
  // TAHAP 3: DEFUZZIFIKASI (Rata-Rata Terbobot)
  // ========================================================
  let sumAlpha = 0,
    sumZKeb = 0,
    sumZKei = 0,
    sumZTab = 0;

  for (let i = 0; i < alpha.length; i++) {
    sumAlpha += alpha[i];
    sumZKeb += alpha[i] * zKeb[i];
    sumZKei += alpha[i] * zKei[i];
    sumZTab += alpha[i] * zTab[i];
  }

  if (sumAlpha === 0) sumAlpha = 1; // Cegah error bagi 0

  let persenKebutuhan = sumZKeb / sumAlpha;
  let persenKeinginan = sumZKei / sumAlpha;
  let persenTabungan = sumZTab / sumAlpha;

  // Normalisasi agar total persentase mutlak 100%
  let totalPersen = persenKebutuhan + persenKeinginan + persenTabungan;
  persenKebutuhan = Math.round((persenKebutuhan / totalPersen) * 100);
  persenKeinginan = Math.round((persenKeinginan / totalPersen) * 100);
  persenTabungan = 100 - (persenKebutuhan + persenKeinginan);

  // Menghitung Nominal
  let nomKebutuhan = (persenKebutuhan / 100) * P;
  let nomKeinginan = (persenKeinginan / 100) * P;
  let nomTabungan = (persenTabungan / 100) * P;

  // ========================================================
  // TAHAP 4: MENYIMPAN KE DATABASE (Kode Baru)
  // ========================================================
  // Mengambil ID dari header yang dikirim oleh Frontend
  const userId = req.headers["user-id"];

  // Jika ada orang asing mencoba akses API tanpa login, tolak!
  if (!userId) {
    return res.status(401).json({ error: "Akses ditolak. Harap login." });
  }
  const bulan = new Date().getMonth() + 1;
  const tahun = new Date().getFullYear();

  const sqlInsert = `
      INSERT INTO rekomendasi 
      (user_id, bulan, tahun, pendapatan, pengeluaran, cicilan, tanggungan, status, 
      persen_kebutuhan, persen_keinginan, persen_tabungan, nominal_kebutuhan, nominal_keinginan, nominal_tabungan) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE 
      pendapatan=VALUES(pendapatan), pengeluaran=VALUES(pengeluaran), cicilan=VALUES(cicilan), 
      tanggungan=VALUES(tanggungan), status=VALUES(status),
      persen_kebutuhan=VALUES(persen_kebutuhan), persen_keinginan=VALUES(persen_keinginan), persen_tabungan=VALUES(persen_tabungan),
      nominal_kebutuhan=VALUES(nominal_kebutuhan), nominal_keinginan=VALUES(nominal_keinginan), nominal_tabungan=VALUES(nominal_tabungan)
  `;

  db.query(
    sqlInsert,
    [
      userId,
      bulan,
      tahun,
      P,
      E,
      C,
      T,
      S,
      persenKebutuhan,
      persenKeinginan,
      persenTabungan,
      nomKebutuhan,
      nomKeinginan,
      nomTabungan,
    ],
    (err) => {
      if (err) console.error("Gagal simpan ke DB:", err);

      // Kirim Hasil ke Frontend
      res.status(200).json({
        kebutuhan: { persen: persenKebutuhan, nominal: nomKebutuhan },
        keinginan: { persen: persenKeinginan, nominal: nomKeinginan },
        tabungan: { persen: persenTabungan, nominal: nomTabungan },
      });
    },
  );
});

// ==========================================
// API ROUTES UNTUK MANAJEMEN PROFIL (USER)
// ==========================================

// 1. Mengambil Data Profil (GET)
app.get("/api/user", (req, res) => {
  const userId = req.headers["user-id"];
  if (!userId) return res.status(401).json({ error: "Akses ditolak" });

  db.query(
    "SELECT id, nama, email FROM users WHERE id = ?",
    [userId],
    (err, results) => {
      if (err || results.length === 0)
        return res.status(500).json({ error: "User tidak ditemukan" });
      res.status(200).json(results[0]);
    },
  );
});

// 2. Mengupdate Profil & Password (PUT)
app.put("/api/user", async (req, res) => {
  const userId = req.headers["user-id"];
  if (!userId) return res.status(401).json({ error: "Akses ditolak" });

  const { nama, email, password_lama, password_baru } = req.body;

  // Cari user di database terlebih dahulu
  db.query(
    "SELECT * FROM users WHERE id = ?",
    [userId],
    async (err, results) => {
      if (err || results.length === 0)
        return res.status(500).json({ error: "User tidak ditemukan" });

      const user = results[0];
      let newPassword = user.password; // Default: gunakan password lama jika tidak diubah

      // Jika user mengisi kolom ganti password
      if (password_lama && password_baru) {
        const isMatch = await bcrypt.compare(password_lama, user.password);
        if (!isMatch)
          return res
            .status(400)
            .json({ error: "Password lama yang Anda masukkan salah!" });

        // Hash password baru
        newPassword = await bcrypt.hash(password_baru, 10);
      }

      // Update data ke database
      const sqlUpdate =
        "UPDATE users SET nama = ?, email = ?, password = ? WHERE id = ?";
      db.query(sqlUpdate, [nama, email, newPassword, userId], (errUpdate) => {
        if (errUpdate) {
          // Error biasanya terjadi jika email baru yang dimasukkan sudah dipakai orang lain
          return res.status(500).json({
            error: "Gagal update profil. Email mungkin sudah digunakan.",
          });
        }
        res
          .status(200)
          .json({ message: "Profil berhasil diperbarui!", newNama: nama });
      });
    },
  );
});

// 3. Menghapus Akun dan Seluruh Datanya (DELETE)
app.delete("/api/user", (req, res) => {
  const userId = req.headers["user-id"];
  if (!userId) return res.status(401).json({ error: "Akses ditolak" });

  // Karena kita tidak memakai ON DELETE CASCADE di SQL awal,
  // kita harus menghapus data di semua tabel anak terlebih dahulu sebelum menghapus akun utama (Mencegah Error Foreign Key).
  db.query("DELETE FROM pemasukan WHERE user_id = ?", [userId], () => {
    db.query("DELETE FROM pengeluaran WHERE user_id = ?", [userId], () => {
      db.query("DELETE FROM tabungan WHERE user_id = ?", [userId], () => {
        db.query("DELETE FROM kategori WHERE user_id = ?", [userId], () => {
          db.query(
            "DELETE FROM rekomendasi WHERE user_id = ?",
            [userId],
            () => {
              // Terakhir, hapus data user itu sendiri
              db.query("DELETE FROM users WHERE id = ?", [userId], (err) => {
                if (err)
                  return res
                    .status(500)
                    .json({ error: "Gagal menghapus akun pengguna" });
                res.status(200).json({
                  message:
                    "Akun dan seluruh data finansial Anda telah dihapus selamanya.",
                });
              });
            },
          );
        });
      });
    });
  });
});

// Menyalakan server
app.listen(PORT, () => {
  console.log(`🚀 Server Smart Pocket berjalan di http://localhost:${PORT}`);
});
