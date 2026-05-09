import { TENSORFLOW_CONFIG, UI_CONFIG, CAMERA_CONFIG } from "./config.js";

export const isMobileDevice = () => {
  return (
    navigator.userAgentData?.mobile ??
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );
};

export const getCameraConfig = () => {
  const mobile = isMobileDevice();
  return {
    defaultFPS: CAMERA_CONFIG.defaultFPS,
    fpsRange: CAMERA_CONFIG.fpsRange,
    resolution: mobile
      ? CAMERA_CONFIG.mobileResolution
      : CAMERA_CONFIG.desktopResolution,
    facingmode: mobile
      ? CAMERA_CONFIG.mobileFacingMode
      : CAMERA_CONFIG.desktopFacingMode,
  };
};

export const createDelay = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const isValidDetection = (result) => {
  const { detectionConfidenceThreshold } = TENSORFLOW_CONFIG;
  return (
    result &&
    result.isValid &&
    result.confidence >= detectionConfidenceThreshold.excellent
  );
};

export const validateModelMetadata = (metadata) => {
  return metadata && metadata.labels && Array.isArray(metadata.labels);
};

export const getCameraConstraints = (selectedCameraId) => {
  const config = getCameraConfig();
  return {
    video: {
      deviceId: selectedCameraId ? { exact: selectedCameraId } : undefined,
      facingMode: config.facingmode,
      width: { ideal: config.resolution.width },
      height: { ideal: config.resolution.height },
      frameRate: {
        ideal: config.defaultFPS,
        min: config.fpsRange.min,
        max: config.fpsRange.max,
      },
    },
  };
};

export const getCameraErrorMessage = (error) => {
  if (error.name === "NotAllowedError") {
    return "Izin kamera ditolak. Harap izinkan akses kamera.";
  } else if (error.name === "NotFoundError") {
    return "Tidak ada kamera ditemukan pada perangkat ini.";
  } else if (error.name === "NotReadableError") {
    return "Kamera sedang digunakan oleh aplikasi lain.";
  }
  return "Gagal memulai kamera";
};

export const addFadeInAnimation = (element) => {
  if (!element) return;

  const { fadeAnimation } = UI_CONFIG;
  element.style.animation = "none";
  void element.offsetWidth; // Trigger reflow to restart animation
  element.style.animation = fadeAnimation;
};

export const updatePerformanceStats = (stats, inferenceTime) => {
  stats.operations++;
  stats.totalTime += inferenceTime;
  stats.averageTime = stats.totalTime / stats.operations;
  return stats;
};

export const logPerformance = (type, backend, operationTime, averageTime) => {
  console.log(
    `⏱️ ${type} - Backend: ${backend.toUpperCase()}, Operation Time: ${Math.round(operationTime)} ms, Average Time: ${Math.round(averageTime)} ms`,
  );
};

export const createPerformanceResult = (
  operationTime,
  backend,
  averageTime,
  totalOperations,
) => ({
  operationTime: Math.round(operationTime),
  backend: backend.toUpperCase(),
  averageTime: Math.round(averageTime),
  operations: totalOperations,
});

export const hideElement = (element) => {
  if (element) element.classList.add("hidden");
};

export const showElement = (element) => {
  if (element) element.classList.remove("hidden");
};

export const setElementText = (element, text) => {
  if (element) element.textContent = text;
};

export const logError = (context, error) => {
  console.error(`❌ ${context}:`, error);
};

export const createModelProgressCallback = (onProgress, throttleMs = 200) => {
  const fileProgress = {};
  let lastMessage = "";
  let lastCallTime = 0;

  return (progress) => {
    // Abaikan jika bukan event progress atau tidak ada file yang sedang dimuat
    if (progress.status !== "progress" || !progress.file) return;

    // Filter hanya untuk file encoder dan decoder
    const isEncoder = progress.file.includes("encoder");
    const isDecoder = progress.file.includes("decoder");
    if (!isEncoder && !isDecoder) return;

    // Update progress untuk file yang sedang dimuat
    fileProgress[progress.file] = Math.round(progress.progress);

    // Hitung rata-rata progress untuk encoder dan decoder
    const encoderProgress = Object.entries(fileProgress).filter(([file]) =>
      file.includes("encoder"),
    );
    const decoderProgress = Object.entries(fileProgress).filter(([file]) =>
      file.includes("decoder"),
    );

    const average = (entries) => {
      if (entries.length === 0) return 0;
      const total = entries.reduce((sum, [, prog]) => sum + prog, 0);
      return Math.round(total / entries.length);
    };

    const encoderAvg = average(encoderProgress);
    const decoderAvg = average(decoderProgress);
    const message = `Memuat model AI... (Encoder: ${encoderAvg}% | Decoder: ${decoderAvg}%)`;

    // Throttle update untuk mencegah terlalu sering memanggil callback
    if (message === lastMessage) return; // Abaikan jika pesan tidak berubah
    const now = Date.now();
    if (now - lastCallTime < throttleMs) return; // Abaikan jika masih dalam periode throttle

    lastMessage = message;
    lastCallTime = now;

    if (onProgress && typeof onProgress === "function") {
      onProgress({ status: "downloading", encoderAvg, decoderAvg, message });
    }
  };
};

export const isWebGPUSupported = () => {
  return typeof navigator !== "undefined" && "gpu" in navigator;
};
