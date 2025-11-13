export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
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
    console.error("Error reading yamsamtar file:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
}
