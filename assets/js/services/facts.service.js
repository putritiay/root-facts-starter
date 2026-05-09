import { PERFORMANCE_CONFIG, TRANSFORMERS_CONFIG } from "../core/config.js";
import {
  createDelay,
  createModelProgressCallback,
  createPerformanceResult,
  logError,
  logPerformance,
  updatePerformanceStats,
  isWebGPUSupported,
} from "../core/utils.js";

class FunFactService {
  constructor(ui = null) {
    this.generator = null;
    this.isModelLoaded = false;
    this.isGenerating = false;
    this.config = TRANSFORMERS_CONFIG;
    this.currentBackend = null;
    this.performanceStats = PERFORMANCE_CONFIG;
    this.ui = ui; // Instance UI untuk feedback progress
  }

  // TODO [Basic] ✅ Implementasikan metode untuk memuat model Transformers.js
  // TODO [Advance] ✅ Gunakan strategi Backend Adaptive seperti yang telah dipelajari sebelumnya
  async loadModel() {
    try {
      // implementasi metode untuk memuat model Transformers.js
      const { pipeline } = await import(this.config.cdnUrl);

      const device = isWebGPUSupported() ? "webgpu" : "wasm";
      console.log(`Using Transformers.js backend: ${device}`);

      this.generator = await pipeline(
        "text2text-generation",
        this.config.modelName,
        {
          dtype: "q4",
          device: device,
          progress_callback: createModelProgressCallback((progress) => {
            if (this.ui && typeof this.ui.showStatus === "function") {
              this.ui.showStatus(progress.message);
            }
          }),
        },
      );
      this.isModelLoaded = true;

      return { success: true, model: this.config.modelName };
    } catch (error) {
      logError("Error loading Transformers.js model", error);
      throw new Error(`Failed to load FunFact model: ${error.message}`);
    }
  }

  // TODO [Basic] ✅ Implementasikan metode untuk menghasilkan fun fact tentang sayuran
  // TODO [Basic] ✅ Tambahkan validasi untuk maksimum panjang input dan pembersihan input terhadap karakter khusus untuk mengatasi prompt injection
  // TODO [Advanced] ✅ Gunakan parameter `tone` untuk variasi personalitas
  async generateFunFact(vegetable, tone = "normal") {
    if (!this.isModelLoaded || this.isGenerating) {
      throw new Error("Model belum siap atau sedang menghasilkan fakta");
    }

    if (!vegetable || typeof vegetable !== "string") {
      throw new Error("Nama sayuran yang valid diperlukan");
    }

    try {
      // implementasi metode untuk menghasilkan fun fact tentang sayuran
      this.isGenerating = true;
      const startTime = performance.now();

      await createDelay(this.config.generationDelay); // Simulasi waktu pemrosesan

      const MAX_INPUT_LENGTH = 50;

      // Sanitasi : Hapus karakter khusus untuk mencegah prompt injection
      vegetable = vegetable
        .replace(/[|]{2,}/g, "") // Hapus karakter | yang berulang
        .replace(/[#=]{2,}/g, "") // Hapus karakter # dan = yang berulang
        .replace(/(--|\+\+|``)/g, "") // Hapus karakter --, ++, dan ``(marker kode) yang berulang
        .replace(/\n/g, " ") // Hapus karakter newline
        .trim();

      // Validasi setelah sanitasi
      if (!vegetable || vegetable.length === MAX_INPUT_LENGTH) {
        this.ui.showError(`Nama sayuran harus 1-${MAX_INPUT_LENGTH} karakter.`);
        this.ui.enableAllInputs();
        this.isGenerating = false;
        return;
      }

      const prompt = `
Write in ${tone} style about ${vegetable} in 1 to 2 sentences`;

      const response = await this.generator(prompt, {
        max_new_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        do_sample: true,
        top_p: this.config.topP,
        repetition_penalty: 2.0,
      });

      const endTime = performance.now();
      const generationTime = endTime - startTime;

      updatePerformanceStats(this.performanceStats, generationTime);

      const generatedText = response[0].generated_text;
      const backendName = this.currentBackend || "unknown";

      logPerformance(
        "Generative",
        backendName,
        generationTime,
        this.performanceStats.averageTime,
      );

      return {
        funFact: generatedText.trim(),
        generated: true,
        performance: createPerformanceResult(
          generationTime,
          backendName,
          this.performanceStats.averageTime,
          this.performanceStats.operations,
        ),
      };
    } catch (error) {
      logError("Error generating fun fact", error);
      throw new Error(`Failed to generate fun fact: ${error.message}`);
    } finally {
      this.isGenerating = false;
    }
  }

  // TODO [Basic] ✅ Periksa apakah model siap dan tidak sedang menghasilkan fakta
  isReady() {
    return this.isModelLoaded && !this.isGenerating;
  }

  // Membersihkan memory dari model generative AI
  async clearMemory() {
    if (this.generator && typeof this.generator.dispose === 'function') {
      try {
        await this.generator.dispose();
      } catch (error) {
        console.warn("Failed to dispose generator:", error);
      }
    }
    this.generator = null;
    this.isModelLoaded = false;
  }
}

export default FunFactService;
