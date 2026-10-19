import Foundation
import CryptoKit
import LocalAuthentication
import SystemConfiguration
import Security
import Darwin

// One inherited unnamed stream endpoint. No stdout authentication or credential channel.
func refuse() -> Never { exit(1) }
func exact(_ value: [String: Any], _ keys: [String]) -> Bool { Set(value.keys) == Set(keys) }
func canonical(_ object: Any) throws -> Data { try JSONSerialization.data(withJSONObject: object, options: [.sortedKeys, .withoutEscapingSlashes]) }
func readExact(_ count: Int) -> Data {
    var bytes = [UInt8](repeating: 0, count: count); var offset = 0
    while offset < count {
        let n = bytes.withUnsafeMutableBytes { Darwin.read(3, $0.baseAddress!.advanced(by: offset), count - offset) }
        if n <= 0 { refuse() }; offset += n
    }
    return Data(bytes)
}
var socketType: Int32 = 0; var typeLength = socklen_t(MemoryLayout<Int32>.size)
guard CommandLine.arguments.count == 1, getuid() == 502, getgid() == 20,
      getsockopt(3, SOL_SOCKET, SO_TYPE, &socketType, &typeLength) == 0, socketType == SOCK_STREAM else { refuse() }
var peerUid: uid_t = 0; var peerGid: gid_t = 0
guard getpeereid(3, &peerUid, &peerGid) == 0, peerUid == 0, peerGid == 0 else { refuse() }
var consoleUid: uid_t = 0; var consoleGid: gid_t = 0
let console = SCDynamicStoreCopyConsoleUser(nil, &consoleUid, &consoleGid) as String?
guard console == "yanfenma", consoleUid == 502, consoleGid == 20 else { refuse() }
var securitySession = SecuritySessionId(0)
var sessionAttributes = SessionAttributeBits(rawValue: 0)
guard SessionGetInfo(callerSecuritySession, &securitySession, &sessionAttributes) == errSecSuccess,
      (sessionAttributes.rawValue & 0x0010) != 0 else { refuse() }
var readTimeout = timeval(tv_sec: 120, tv_usec: 0)
guard setsockopt(3, SOL_SOCKET, SO_RCVTIMEO, &readTimeout, socklen_t(MemoryLayout<timeval>.size)) == 0 else { refuse() }
let lengthBytes = readExact(4)
let length = lengthBytes.reduce(0) { ($0 << 8) | Int($1) }
guard length > 0, length <= 65536 else { refuse() }
let data = readExact(length)
var trailing: UInt8 = 0
guard Darwin.read(3, &trailing, 1) == 0 else { refuse() }
guard let request = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
      let encoded = try? canonical(request), encoded == data,
      exact(request, ["kind", "intent", "intent_digest", "challenge_nonce", "receiver_start_nonce", "helper_start_nonce", "deadline"]),
      request["kind"] as? String == "authenticate",
      let intent = request["intent"] as? [String: Any],
      let digest = request["intent_digest"] as? String, digest.range(of: "^[0-9a-f]{64}$", options: .regularExpression) != nil,
      let deadlineString = request["deadline"] as? String else { refuse() }
guard let intentBytes = try? canonical(intent), SHA256.hash(data: intentBytes).map({ String(format: "%02x", $0) }).joined() == digest else { refuse() }
let dateFormat = ISO8601DateFormatter(); dateFormat.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
guard let deadline = dateFormat.date(from: deadlineString), deadline > Date(), deadline.timeIntervalSinceNow <= 120,
      let expiry = intent["expires_at"] as? String,
      intent["issuer"] as? String == "mayf3",
      let capabilities = intent["capabilities"] as? [String], capabilities == ["registry-migrate-agent-v1", "candidate-load", "supply", "registry-disable-migrated", "recover-delivery"] else { refuse() }
let context = LAContext()
context.touchIDAuthenticationAllowableReuseDuration = 0
var error: NSError?
guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else { context.invalidate(); refuse() }
let purpose = "Authorize the original Auth MCP pilot executor. agent-core-mcp-conversation-v1 / conversation.access. Capabilities: \(capabilities.joined(separator: ", ")). Expires: \(expiry). Intent SHA256: \(digest)"
let done = DispatchSemaphore(value: 0)
let guardLock = NSLock(); var result = false
context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: purpose) { success, _ in
    guardLock.lock(); result = success; guardLock.unlock(); done.signal()
}
let timely = done.wait(timeout: .now() + max(0, deadline.timeIntervalSinceNow)) == .success
context.invalidate()
guardLock.lock(); let authenticated = timely && result && Date() <= deadline; guardLock.unlock()
let reply: [String: Any] = ["kind": "authentication-result", "intent_digest": digest,
    "challenge_nonce": request["challenge_nonce"]!, "helper_start_nonce": request["helper_start_nonce"]!,
    "result": authenticated ? "authenticated" : "refused", "observed_at": dateFormat.string(from: Date())]
guard let response = try? canonical(reply) else { refuse() }
var count = UInt32(response.count).bigEndian
var frame = withUnsafeBytes(of: &count) { Data($0) }; frame.append(response)
frame.withUnsafeBytes { bytes in
    var offset = 0
    while offset < bytes.count { let n = Darwin.write(3, bytes.baseAddress!.advanced(by: offset), bytes.count - offset); if n <= 0 { refuse() }; offset += n }
}
close(3)
exit(authenticated ? 0 : 1)
