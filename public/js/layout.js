// ========================================================
// 1. PROTEKSI HALAMAN (DIEKSEKUSI INSTAN TANPA MENUNGGU HTML)
// ========================================================
const userId = localStorage.getItem("user_id");
const userNama = localStorage.getItem("user_nama");
const currentPage = window.location.pathname.split("/").pop() || "index.html";

// Jika tidak ada user_id dan ini bukan halaman login/register, tendang seketika!
if (
  !userId &&
  currentPage !== "login.html" &&
  currentPage !== "register.html"
) {
  alert("Anda belum login! Silakan login terlebih dahulu.");
  // Menggunakan replace() agar user tidak bisa menekan tombol "Back" di browser
  window.location.replace("login.html");
}

// ========================================================
// 2. KODE UI & SIDEBAR (TUNGGU HTML SELESAI DIMUAT)
// ========================================================
// Jika kode di atas lolos (user sudah login), barulah sisa script di bawah ini dijalankan
document.addEventListener("DOMContentLoaded", function () {
  // GANTI NAMA & AVATAR PENGGUNA OTOMATIS
  if (userId && userNama) {
    const elNama = document.querySelector(".user-profile span.fw-bold");
    if (elNama) {
      elNama.innerText = `Halo, ${userNama}!`;
    }

    const elAvatar = document.querySelector(".user-profile img.rounded-circle");
    if (elAvatar) {
      elAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(userNama)}&background=0d6efd&color=fff&bold=true`;
    }
  }

  // LOAD SIDEBAR & NAVIGASI
  fetch("/components/sidebar.html")
    .then((response) => response.text())
    .then((data) => {
      document.getElementById("sidebar-container").innerHTML = data;

      const navLinks = document.querySelectorAll(".sidebar-nav .nav-item");

      navLinks.forEach((link) => {
        const linkHref = link.getAttribute("href");
        if (linkHref === currentPage) {
          link.classList.add("active");

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
