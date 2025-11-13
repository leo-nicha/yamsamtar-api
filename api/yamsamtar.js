import path from 'path';
import { promises as fs } from 'fs'; // 1. Import fs/promises

// --- (ต้องมี) Helper Functions ของคุณ ---
// ตรวจสอบว่าฟังก์ชันเหล่านี้มีอยู่จริง
// function getYamByTime(yamHours, time) { ... }
// function getNextYam(currentYam, yams) { ... }
// ----------------------------------------

// 2. โหลดข้อมูล JSON ครั้งเดียวตอน Server/Function เริ่มทำงาน
// เราใช้ Top-level await ที่นี่ได้เลย
const filePath = path.join(process.cwd(), "data", "yamsamtar.json");
let data;
try {
  const jsonData = await fs.readFile(filePath, "utf-8");
  data = JSON.parse(jsonData);
  console.log("Yamsamtar data loaded successfully.");
} catch (error) {
  console.error("CRITICAL: Failed to load yamsamtar.json on startup:", error);
  // ถ้าไฟล์นี้จำเป็นมาก API อาจจะทำงานไม่ได้เลย
}

// --- API Handler ---
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*"); // หรือโดเมนของคุณ
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  // 3. ตรวจสอบว่า data โหลดสำเร็จหรือไม่
  if (!data) {
    console.error("Data is not loaded. Service unavailable.");
    return res.status(503).json({ error: "Service Temporarily Unavailable" });
  }

  try {
    const { day, time, birth } = req.query; // เพิ่ม birth สำหรับวันเกิด

    if (!day || !time) {
      return res.status(400).json({ error: "กรุณาระบุวัน (day) และเวลา (time)" });
    }

    // ตรวจสอบและแปลงวันเกิดเป็น ค.ศ.
    let correctedBirth = null;
    if (birth) {
      const birthDate = new Date(birth);
      if (isNaN(birthDate.getTime())) {
        return res.status(400).json({ error: "รูปแบบวันเกิดไม่ถูกต้อง" });
      }

      let year = birthDate.getUTCFullYear();
      if (year > 2400) {
        year -= 543; // แปลงจาก พ.ศ. เป็น ค.ศ.
      }

      correctedBirth = new Date(
        Date.UTC(
          year,
          birthDate.getUTCMonth(),
          birthDate.getUTCDate(),
          birthDate.getUTCHours(),
          birthDate.getUTCMinutes()
        )
      );
    }

    // 4. ไม่ต้องอ่านไฟล์แล้ว ใช้ 'data' ที่โหลดไว้ได้เลย
    // const filePath = path.join(process.cwd(), "data", "yamsamtar.json");
    // const jsonData = await fs.readFile(filePath, "utf-8");
    // const data = JSON.parse(jsonData);

    // ตรวจสอบว่าวันมีอยู่จริงไหม
    if (!data.days.includes(day)) {
      return res.status(400).json({ error: `ไม่พบข้อมูลของวัน "${day}"` });
    }

    // หายามปัจจุบัน
    const yam = getYamByTime(data.yam_hours, time); // (ต้องมีฟังก์ชันนี้)
    if (!yam) {
      return res.status(400).json({ error: `เวลา ${time} ไม่อยู่ในช่วงยามใดเลย` });
    }

    // หาคำทำนายของยามปัจจุบัน
    const resultName = data.table[day][yam];
    const resultMeaning = data.meanings[resultName] || "ไม่มีคำทำนาย";

    // หายามถัดไป (ตาที่สาม)
    const thirdYam = getNextYam(yam, data.yams); // (ต้องมีฟังก์ชันนี้)
    const thirdResultName = data.table[day][thirdYam];
    const thirdResultMeaning = data.meanings[thirdResultName] || "ไม่มีคำทำนาย";

    // ส่งผลลัพธ์กลับ
    res.setHeader("Access-Control-Allow-Origin", "*"); // หรือโดเมนของคุณ
    res.status(200).json({
      input: { day, time, birth: correctedBirth ? correctedBirth.toISOString() : null },
      current_yam: yam,
      current_result: {
        name: resultName,
        meaning: resultMeaning,
      },
      third_eye: {
        yam: thirdYam,
        result: thirdResultName,
        meaning: thirdResultMeaning,
      },
    });
  } catch (error) {
    console.error("API handler error:", error); // แก้ไขข้อความ Error log
    res.status(500).json({ error: "Internal Server Error" });
  }
}