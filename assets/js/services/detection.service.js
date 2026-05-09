import { PERFORMANCE_CONFIG, TENSORFLOW_CONFIG } from "../core/config.js";
import {
  validateModelMetadata,
  logError,
  updatePerformanceStats,
  createPerformanceResult,
  logPerformance,
  isWebGPUSupported,
} from "../core/utils.js";

class DetectionService {
  constructor() {
    this.model = null;
    this.labels = [];
    this.performanceStats = PERFORMANCE_CONFIG;
    this.config = TENSORFLOW_CONFIG;
  }

  // TODO [Basic] ✅ Implementasikan metode untuk memuat model TensorFlow.js
  // TODO [Basic] ✅ Gunakan validateModelMetadata() untuk memeriksa metadata model
  // TODO [Advance] ✅ Gunakan strategi Backend Adaptive seperti yang telah dipelajari sebelumnya
  async loadModel() {
    try {
      const backend = isWebGPUSupported() ? "webgpu" : "webgl";

      await tf.setBackend(backend);
      await tf.ready();

      const backendName = tf.getBackend();
      console.log(`Using TensorFlow.js backend: ${backendName}`);

      // Implementasi metode untuk memuat model TensorFlow.js
      const [metadata, model] = await Promise.all([
        fetch(this.config.metadataPath).then((res) => res.json()),
        tf.loadLayersModel(this.config.modelPath),
      ]);

      // Gunakan validateModelMetadata() untuk memeriksa metadata model
      if (!validateModelMetadata(metadata)) {
        throw new Error("Metadata tidak valid: array labels tidak ditemukan");
      }

      this.model = model;
      this.labels = metadata.labels;

      return {
        success: true,
        labels: this.labels,
        modelName: metadata.modelName || "Unknown Model",
        version: metadata.version || "Unknown Version",
        backend: backendName,
      };
    } catch (error) {
      logError("Failed to load model", error);
      throw new Error(`Failed to load model: ${error.message}`);
    }
  }

  // TODO [Basic] ✅ Implementasikan metode untuk melakukan prediksi pada elemen gambar
  async predict(imageElement) {
    if (!this.model) {
      throw new Error(
        "Model belum dimuat. Pastikan loadModel() dipanggil sebelum melakukan prediksi.",
      );
    }

    if (!imageElement) {
      throw new Error("Elemen gambar tidak ditemukan untuk prediksi.");
    }

    let tensor = null;
    let predictions = null;
    const startTime = performance.now();

    try {
      // TODO [Basic] ✅ Lakukan preprocessing pada imageElement untuk menghasilkan tensor input yang sesuai dengan model
      tensor = tf.tidy(() => {
        return tf.browser
          .fromPixels(imageElement)
          .resizeBilinear(this.config.inputSize) // Ubah ukuran sesuai dengan input model
          .expandDims(0) // Tambahkan dimensi batch
          .div(this.config.normalizationFactor); // Normalisasi ke rentang [0, 1]
      });

      predictions = this.model.predict(tensor);
      const values = await predictions.data();

      const endTime = performance.now();
      const inferenceTime = endTime - startTime;

      updatePerformanceStats(this.performanceStats, inferenceTime);

      // Cari label dengan confidence tertinggi
      const maxIndex = values.indexOf(Math.max(...values));
      const confidence = Math.round(values[maxIndex] * 100);
      const className = this.labels[maxIndex] || "Unknown";
      const isValid =
        confidence >= this.config.detectionConfidenceThreshold.excellent;
      const backendName = tf.getBackend();

      const result = {
        className: className,
        confidence: confidence,
        isValid: isValid,
        performance: createPerformanceResult(
          inferenceTime,
          backendName,
          this.performanceStats.averageTime,
          this.performanceStats.operations,
        ),
      };

      logPerformance(
        "Detection",
        backendName,
        inferenceTime,
        this.performanceStats.averageTime,
      );

      return result;
    } catch (error) {
      logError("Kesalahan prediksi", error);
      throw new Error(`Prediksi gagal: ${error.message}`);
    } finally {
      // TODO [Basic] ✅ Dispose tensor dan predictions untuk menghindari memory leak
      if (tensor) tensor.dispose();
      if (predictions) predictions.dispose();
    }
  }

  // TODO [Basic] ✅ Periksa apakah model sudah dimuat
  isLoaded() {
    return !!this.model && this.labels.length > 0;
  }
}

export default DetectionService;
