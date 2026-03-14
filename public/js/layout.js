document.addEventListener("DOMContentLoaded", function () {
  // ========================================================
  // 1. PROTEKSI HALAMAN & AMBIL DATA USER (LOGIKA BARU)
  // ========================================================
  const userId = localStorage.getItem("user_id");
  const userNama = localStorage.getItem("user_nama");

  // Mengambil nama file saat ini (misal: "pemasukan.html")
  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  // Jika tidak ada user_id di memori browser dan ini bukan halaman login/register,
  // maka tendang paksa ke halaman login.
  if (
    !userId &&
    currentPage !== "login.html" &&
    currentPage !== "register.html"
  ) {
    alert("Anda belum login! Silakan login terlebih dahulu.");
    window.location.href = "login.html";
    return; // Hentikan eksekusi kode di bawahnya
  }

  // ========================================================
  // 2. GANTI NAMA & AVATAR PENGGUNA OTOMATIS (LOGIKA BARU)
  // ========================================================
  if (userId && userNama) {
    // Cari elemen tulisan nama pengguna di navbar (Mencari tag span berkelas fw-bold di dalam .user-profile)
    const elNama = document.querySelector(".user-profile span.fw-bold");
    if (elNama) {
      elNama.innerText = `Halo, ${userNama}!`;
    }

    // Cari elemen gambar avatar
    const elAvatar = document.querySelector(".user-profile img.rounded-circle");
    if (elAvatar) {
      elAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userNama)}&background=0d6efd&color=fff&bold=true`;
    }
  }

  // ========================================================
  // 3. LOAD SIDEBAR & NAVIGASI (KODE ASLI ANDA)
  // ========================================================
  // Mengambil file sidebar.html
  fetch("/components/sidebar.html")
    .then((response) => response.text())
    .then((data) => {
      // Menempelkan sidebar ke dalam wadah yang disiapkan di HTML
      document.getElementById("sidebar-container").innerHTML = data;

      // Logika mendeteksi halaman aktif
      const navLinks = document.querySelectorAll(".sidebar-nav .nav-item");

      navLinks.forEach((link) => {
        const linkHref = link.getAttribute("href");
        if (linkHref === currentPage) {
          link.classList.add("active"); // Jadikan biru sebagai default

          // Khusus halaman pengeluaran, ubah warna aktifnya jadi merah
          if (currentPage === "pengeluaran.html") {
            link.style.backgroundColor = "#e74c3c";
            link.style.borderLeft = "5px solid #c0392b";
          }
        }
      });

      // Logika Tombol Mobile
      const toggleBtn = document.getElementById("toggleSidebar");
      const sidebar = document.getElementById("sidebar");
      const overlay = document.getElementById("overlay");

      if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
          sidebar.classList.add("show");
          overlay.classList.add("show");
        });
      }

      if (overlay) {
        overlay.addEventListener("click", () => {
          sidebar.classList.remove("show");
          overlay.classList.remove("show");
        });
      }
    })
    .catch((error) => console.error("Gagal memuat sidebar:", error));
});
