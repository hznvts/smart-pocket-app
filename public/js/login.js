// Menangkap event saat form disubmit
document
  .getElementById("formLogin")
  .addEventListener("submit", function (event) {
    event.preventDefault(); // Mencegah halaman refresh

    // Mengambil nilai dari inputan
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const alertBox = document.getElementById("alertPesan");

    // Menyiapkan data untuk dikirim ke backend
    const dataKirim = {
      email: email,
      password: password,
    };

    // Mengirim data ke Node.js Backend menggunakan Fetch API
    fetch("/api/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataKirim),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          // ========================================================
          // 1. TAMBAHAN BARU: SIMPAN DATA USER KE MEMORI BROWSER
          // ========================================================
          localStorage.setItem("user_id", data.user.id);
          localStorage.setItem("user_nama", data.user.nama);

          // Jika login berhasil, sembunyikan error dan pindah halaman
          alertBox.classList.add("d-none");
          window.location.href = "index.html";
        } else {
          // Jika login gagal (password salah/email tidak ada)
          alertBox.classList.remove("d-none");
          alertBox.innerText = data.message;
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        alertBox.classList.remove("d-none");
        alertBox.innerText = "Terjadi kesalahan pada server.";
      });
  }); // <--- PENUTUP EVENT LISTENER FORM LOGIN SAMPAI DI SINI

// ========================================================
// 2. FUNGSI GOOGLE LOGIN (HARUS BERADA DI LUAR EVENT LISTENER)
// ========================================================
// Fungsi ini dipanggil otomatis oleh Google setelah user memilih akun
function handleGoogleLogin(response) {
  const googleToken = response.credential;
  const alertBox = document.getElementById("alertPesan");

  // Mengirim token rahasia dari Google ke server Node.js kita
  fetch("/api/google-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: googleToken }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        alertBox.classList.add("d-none");
        console.log("Login Google sukses:", data.user);

        // Simpan data dari Google ke memori browser
        localStorage.setItem("user_nama", data.user.name);

        // Pindah ke dashboard
        window.location.href = "index.html";
      } else {
        alertBox.classList.remove("d-none");
        alertBox.innerText = data.message;
      }
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}
