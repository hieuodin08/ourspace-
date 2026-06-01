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
  apiKey: "AIzaSyBiP63AIcOmWllP_suNYV2KdshVsU0QnzI",
  authDomain: "our-space-6404b.firebaseapp.com",
  projectId: "our-space-6404b",
  storageBucket: "our-space-6404b.firebasestorage.app",
  messagingSenderId: "709452238055",
  appId: "1:709452238055:web:32d83251c0e04711156642",
  measurementId: "G-Q4SWQ0QLJ3",
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
//      }
//      // Bảng tra cứu username -> uid
//      match /usernames/{name} {
//        allow read: if request.auth != null;
//        allow create: if request.auth != null;
//      }
//      // Kết bạn: chỉ 2 người trong cặp mới đọc/sửa/xoá. Khi tạo lời mời,
//      // người gửi phải là chính mình (requestedBy == uid đang đăng nhập).
//      match /friendships/{pairId} {
//        allow read, update, delete: if request.auth != null
//          && request.auth.uid in resource.data.members;
//        allow create: if request.auth != null
//          && request.auth.uid in request.resource.data.members
//          && request.resource.data.requestedBy == request.auth.uid;
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
