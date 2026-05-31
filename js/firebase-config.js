// ============================================================================
//  CẤU HÌNH FIREBASE  —  BẠN CHỈ CẦN SỬA FILE NÀY
// ============================================================================
//
//  Ourspace dùng Firebase (miễn phí) để đồng bộ tài khoản, danh bạ và tin nhắn
//  giữa mọi thiết bị. Làm theo 4 bước sau (khoảng 3 phút):
//
//  1) Vào  https://console.firebase.google.com  → "Add project" (tạo dự án).
//  2) Trong dự án: bấm biểu tượng </> ("Web") để đăng ký 1 web app.
//     Firebase sẽ hiện 1 object `firebaseConfig` — copy các giá trị vào bên dưới.
//  3) Mở mục  Build → Authentication → Get started → bật "Email/Password".
//  4) Mở mục  Build → Firestore Database → Create database
//        → chọn "Start in test mode" (cho lúc demo) → Enable.
//
//  Sau khi điền xong, lưu file và tải lại trang. Xong!
//
//  (Khi deploy thật, nhớ thay luật Firestore test-mode bằng luật bảo mật —
//   xem hướng dẫn cuối file.)
// ============================================================================

window.OURSPACE_FIREBASE_CONFIG = {
  apiKey: "DAN_API_KEY_CUA_BAN_VAO_DAY",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxx",
};

// ----------------------------------------------------------------------------
//  GỢI Ý LUẬT FIRESTORE KHI DEPLOY THẬT (dán vào tab Rules của Firestore):
//
//  rules_version = '2';
//  service cloud.firestore {
//    match /databases/{database}/documents {
//      // Hồ sơ người dùng: ai đăng nhập cũng đọc được (để tìm bạn), chỉ chủ sửa
//      match /users/{uid} {
//        allow read: if request.auth != null;
//        allow write: if request.auth != null && request.auth.uid == uid;
//        match /contacts/{c} {
//          allow read, write: if request.auth != null && request.auth.uid == uid;
//        }
//      }
//      // Bảng tra cứu username -> uid
//      match /usernames/{name} {
//        allow read: if request.auth != null;
//        allow create: if request.auth != null;
//      }
//      // Hội thoại: chỉ thành viên mới đọc/ghi
//      match /conversations/{cid} {
//        allow read, write: if request.auth != null
//          && request.auth.uid in resource.data.members;
//        allow create: if request.auth != null
//          && request.auth.uid in request.resource.data.members;
//        match /messages/{mid} {
//          allow read, write: if request.auth != null;
//        }
//      }
//    }
//  }
// ----------------------------------------------------------------------------
