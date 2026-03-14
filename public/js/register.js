// Menangkap event saat form pendaftaran disubmit
document
  .getElementById("formRegister")
  .addEventListener("submit", function (event) {
    event.preventDefault(); // Mencegah halaman refresh otomatis

    // Mengambil nilai dari inputan form
    const nama = document.getElementById("nama").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;

    // (Opsional) Jika Anda punya kolom konfirmasi password di HTML
    // const confirmPassword = document.getElementById("confirmPassword").value;
    // if (password !== confirmPassword) {
    //     alert("Password dan Konfirmasi Password tidak cocok!");
    //     return;
    // }

    const alertBox = document.getElementById("alertPesan");

    // Menyiapkan data untuk dikirim ke backend
    const dataKirim = {
      nama: nama,
      email: email,
      password: password,
    };

    // Mengirim data ke Node.js Backend menggunakan Fetch API
    fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dataKirim),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.status === "success") {
          // Jika pendaftaran berhasil
          if (alertBox) alertBox.classList.add("d-none");

          // Munculkan notifikasi sukses dan pindahkan ke halaman Login
          alert("Pendaftaran berhasil! Silakan login dengan akun baru Anda.");
          window.location.href = "login.html";
        } else {
          // Jika pendaftaran gagal (contoh: Email sudah terdaftar)
          if (alertBox) {
            alertBox.classList.remove("d-none");
            alertBox.classList.replace("alert-success", "alert-danger"); // Pastikan warnanya merah
            alertBox.innerText = data.message;
          } else {
            alert(data.message);
          }
        }
      })
      .catch((error) => {
        console.error("Error:", error);
        if (alertBox) {
          alertBox.classList.remove("d-none");
          alertBox.innerText = "Terjadi kesalahan pada server.";
        }
      });
  });

// Fungsi untuk menangani login/daftar via Google (Sama seperti di login.js)
function handleGoogleLogin(response) {
  const googleToken = response.credential;

  fetch("/api/google-login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: googleToken }),
  })
    .then((res) => res.json())
    .then((data) => {
      if (data.status === "success") {
        window.location.href = "index.html";
      } else {
        tampilkanPesan("danger", data.message);
      }
    })
    .catch((error) => console.error("Error:", error));
}
