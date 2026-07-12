export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold">เข้าสู่ระบบไม่สำเร็จ</h1>
      <p className="text-neutral-500">
        ลิงก์ยืนยันตัวตนไม่ถูกต้องหรือหมดอายุแล้ว กรุณาลองเข้าสู่ระบบใหม่อีกครั้ง
      </p>
      <a href="/login" className="text-blue-600 underline">
        กลับไปหน้าเข้าสู่ระบบ
      </a>
    </main>
  );
}
