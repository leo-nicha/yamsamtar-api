import path from "path";
import fs from "fs/promises";

/**
 * Utility: หายามตามเวลา
 */
function getYamByTime(yamHours, timeStr) {
  const [hour, minute] = timeStr.split(":").map(Number);
  const totalMinutes = hour * 60 + minute;

  for (const [yam, range] of Object.entries(yamHours)) {
    const [startH, startM] = range.start.split(":").map(Number);
    const [endH, endM] = range.end.split(":").map(Number);

    const startTotal = startH * 60 + startM;
    const endTotal = endH * 60 + endM;

    if (startTotal <= totalMinutes && totalMinutes <= endTotal) {
      return yam;
    }
  }
  return null;
}

/**
 * Utility: หายามถัดไป (ตาที่สาม)
 */
function getNextYam(currentYam, yams) {
  const idx = yams.indexOf(currentYam);
  if (idx === -1) return yams[0]; // fallback
  const nextIdx = (idx + 1) % yams.length;
  return yams[nextIdx];
}

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  try {
    const { day, time } = req.query;

    if (!day || !time) {
      return res.status(400).json({ error: "กรุณาระบุวัน (day) และเวลา (time)" });
    }

    // โหลดข้อมูลจากไฟล์ yamsamtar.json
    const filePath = path.join(process.cwd(), "data", "yamsamtar.json");
    const jsonData = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(jsonData);

    // ตรวจสอบว่าวันมีอยู่จริงไหม
    if (!data.days.includes(day)) {
      return res.status(400).json({ error: `ไม่พบข้อมูลของวัน "${day}"` });
    }

    // หายามปัจจุบัน
    const yam = getYamByTime(data.yam_hours, time);
    if (!yam) {
      return res.status(400).json({ error: `เวลา ${time} ไม่อยู่ในช่วงยามใดเลย` });
    }

    // หาคำทำนายของยามปัจจุบัน
    const resultName = data.table[day][yam];
    const resultMeaning = data.meanings[resultName] || "ไม่มีคำทำนาย";

    // หายามถัดไป (ตาที่สาม)
    const thirdYam = getNextYam(yam, data.yams);
    const thirdResultName = data.table[day][thirdYam];
    const thirdResultMeaning = data.meanings[thirdResultName] || "ไม่มีคำทำนาย";

    // ส่งผลลัพธ์กลับ
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.status(200).json({
      input: { day, time },
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
    console.error("Error reading yamsamtar file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
