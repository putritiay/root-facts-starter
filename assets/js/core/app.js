import CameraService from "../services/camera.service.js";
import DetectionService from "../services/detection.service.js";
import FactsService from "../services/facts.service.js";
import UIHandler from "../ui/ui.handler.js";
import { APP_CONFIG } from "./config.js";
import { createDelay, isValidDetection, logError } from "./utils.js";

class RootFactsApp {
  constructor() {
    this.detector = null;
    this.camera = null;
    this.funFactGenerator = null;
    this.ui = new UIHandler();
    this.isRunning = false;
    this.currentLoopId = null;
    this.config = APP_CONFIG;
    this.currentFunFact = "";

    // TODO [Advanced] ✅ Tambahkan properti untuk tone yang dipilih
    this.currentTone = "normal";

    this.ui.disableButton();

    this.bindEvents();
    this.init();

    // TODO [Basic] ✅ Panggil registerServiceWorker()
    this.registerServiceWorker();
  }

  // TODO [Basic] ✅ Bind toggle camera event dengan nama onToggleCamera
  // TODO [Basic] ✅ Bind camera change event dengan nama onCameraChange
  // TODO [Skilled] ✅ Bind FPS change event dengan nama onFPSChange
  // TODO [Skilled] ✅ Bind copy fun fact event dengan nama onCopy
  // TODO [Advanced] ✅ Bind tone change event dengan nama onToneChange

  bindEvents() {
    this.ui.bindEvents({
      onToggleCamera: () => this.toggleCamera(),
      onCameraChange: () => {
        if (this.camera && this.camera.isActive()) {
          this.startCamera();
        }
      },
      onFPSChange: (newFPS) => {
        if (this.camera) {
          this.camera.setFPS(newFPS);
        }
      },
      onToneChange: (newTone) => {
        this.currentTone = newTone;
      },
      onCopy: async () => await this.copyFunFact(),
    });
  }

  // TODO [Skilled] ✅ Perbarui status header UI menjadi 'Memuat model...' saat memulai inisialisasi
  /**
   * TODO [Basic]
   * Lengkapi fungsi init untuk menginisialisasi kemampuan aplikasi:
   * [✅] Kemampuan deteksi (DetectionService)
   * [✅] Kamera (CameraService)
   * [✅] Kemampuan generatif (FactsService)
   */
  // TODO [Skilled] ✅ Perbarui status header UI menjadi 'Siap'

  async init() {
    try {
      this.ui.updateHeaderStatus("Memuat model AI...", true);

      // Inisialisasi kemampuan deteksi (DetectionService)
      this.detector = new DetectionService();
      await this.detector.loadModel();

      // Inisialisasi kemampuan kamera (CameraService)
      this.camera = new CameraService();

      // Inisialisasi kemampuan generatif (FactsService)
      this.generator = new FactsService(this.ui);
      try {
        await this.generator.loadModel();
      } catch (error) {
        logError("Layanan fun fact gagal dimuat (mode Offline?)", error);
        this.generator = null; // Set generator ke null jika gagal dimuat, aplikasi tetap bisa berjalan dengan mode offline tanpa fun fact generatif
      }

      // Perbarui status header UI menjadi 'Siap'
      this.ui.updateHeaderStatus("Siap", false);
      this.ui.enableButton();
    } catch (error) {
      logError("Gagal menginisialisasi aplikasi", error);

      // TODO [Skilled] ✅ Perbarui status header UI menjadi 'Error' jika inisialisasi gagal
      this.ui.updateHeaderStatus("Error", false);
      this.ui.showError(`Gagal menginisialisasi: ${error.message}`);
      this.ui.disableButton("Model Gagal Dimuat");
    }
  }

  // TODO [Basic] ✅ Buatlah berkas sw.js di root project dan konfigurasikan precaching di dalamnya menggunakan Workbox

  // TODO [Basic] ✅ Registrasikan Service Worker
  registerServiceWorker() {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          console.log("Service Worker terdaftar:", registration);
        })
        .catch((error) => {
          logError("Gagal mendaftarkan Service Worker", error);
        });
    }
  }

  // TODO [Skilled] ✅ Buatlah metode untuk menyalin fun fact ke clipboard
  async copyFunFact() {
    const textToCopy = this.currentFunFact || this.ui.getFunFactText();
    if (!textToCopy) return;

    let success = false;

    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(textToCopy);
        success = true;
      } catch (err) {
        console.warn("Modern clipboard API gagal, beralih ke fallback", err);
      }
    }

    if (!success) {
      try {
        const textArea = document.createElement("textarea");
        textArea.value = textToCopy;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        success = document.execCommand("copy");
        textArea.remove();
      } catch (err) {
        console.error("Fallback copy juga gagal", err);
      }
    }

    if (success) {
      this.ui.setCopyButtonCopied();
      setTimeout(() => {
        this.ui.resetCopyButton();
      }, 2000);
    } else {
      logError("Gagal menyalin fun fact", new Error("Copy tidak didukung browser"));
    }
  }

  // TODO [Basic] ✅ Implementasikan metode untuk mengaktifkan atau menonaktifkan kamera
  toggleCamera() {
    if (!this.detector || !this.detector.isLoaded()) {
      this.ui.showError(
        "Model deteksi AI belum siap. Mohon tunggu inisialisasi selesai.",
      );
      return;
    }

    if (!this.isRunning) {
      this.startCamera();
    } else {
      this.stopCamera();
    }
  }

  // TODO [Basic] ✅ Implementasikan metode untuk memulai kamera
  async startCamera() {
    try {
      this.ui.updateCameraUI(true);

      if (this.camera) {
        await this.camera.startCamera();
        this.startDetection();
      } else {
        throw new Error("Modul kamera belum diinisialisasi");
      }
    } catch (error) {
      logError("Gagal memulai kamera", error);
      this.ui.updateCameraUI(false);
      this.ui.showError(`Gagal memulai kamera: ${error.message}`);
    }
  }

  // TODO [Basic] ✅ Implementasikan metode untuk menghentikan kamera
  stopCamera() {
    this.isRunning = false;
    this.stopDetection();

    if (this.camera) {
      this.camera.stopCamera();
    }

    this.ui.updateCameraUI(false, true);
  }

  // TODO [Basic] ✅ Implementasikan metode untuk memulai deteksi
  startDetection() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.currentLoopId = Date.now() + Math.random();
    this.detectLoop(this.currentLoopId);
  }

  // TODO [Basic] ✅ Implementasikan metode untuk menghentikan deteksi
  stopDetection() {
    this.isRunning = false;
    this.currentLoopId = null;
  }

  // TODO [Basic] ✅ Implementasikan metode deteksi utama
  async detectLoop(loopId) {
    if (!this.isRunning || this.currentLoopId !== loopId) {
      return;
    }

    if (!this.camera.isReady() || !this.detector.isLoaded()) {
      setTimeout(
        () => this.detectLoop(loopId),
        this.config.detectionRetryInterval,
      );
      return;
    }

    try {
      const canvas = this.camera.captureFrame();
      if (!canvas) {
        if (this.isRunning && this.currentLoopId === loopId) {
          requestAnimationFrame(() => this.detectLoop(loopId));
        }
        return;
      }

      const detectionResult = await this.detector.predict(canvas);

      console.log("Hasil Deteksi:", detectionResult);

      if (isValidDetection(detectionResult)) {
        this.stopDetection();
        this.ui.switchToState("result");
        await createDelay(this.config.analyzingDelay);
        this.generateAndShowResults(detectionResult);
      }
    } catch (error) {
      logError("Gagal menangkap frame kamera", error);
    }
    if (this.isRunning && this.currentLoopId === loopId) {
      requestAnimationFrame(() => this.detectLoop(loopId));
    }
  }

  // TODO [Basic] ✅ Implementasikan metode untuk menghasilkan dan menampilkan fun fact
  async generateAndShowResults(detectionResult) {
    try {
      this.ui.showResults(detectionResult, null);

      // Set isRunning ke false untuk menghentikan loop deteksi
      this.isRunning = false;
      this.stopDetection();

      if (this.camera) {
        this.camera.stopCamera();
      }

      this.ui.updateCameraUI(false, true);

      if (this.generator) {
        if (!this.generator.isModelLoaded) {
          this.ui.updateHeaderStatus("Memuat model Fun Fact...", true);
          try {
            await this.generator.loadModel();
          } catch (e) {
            logError("Gagal memuat ulang model fun fact", e);
          }
          this.ui.updateHeaderStatus("Siap", false);
        }

        if (this.generator.isReady()) {
          await createDelay(this.config.funFactGenerationDelay);
          this.ui.updateFunFactState("loading");

          try {
            const funFactData = await this.generator.generateFunFact(
              detectionResult.className,
              this.currentTone,
            );
            this.currentFunFact = funFactData.funFact;
            this.ui.updateFunFactState("success", funFactData);

            // Bersihkan memory setelah selesai memberikan prediksi untuk menghindari bug
            await this.generator.clearMemory();
          } catch (funFactError) {
            logError("Gagal menghasilkan konten fun fact", funFactError);
            this.ui.updateFunFactState("error");
          }
        } else {
          this.ui.updateFunFactState("error");
        }
      } else {
        this.ui.updateFunFactState("error");
      }
    } catch (error) {
      logError("Gagal menampilkan hasil", error);
      this.ui.updateFunFactState("error");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const app = new RootFactsApp();

  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }
});

export default RootFactsApp;
