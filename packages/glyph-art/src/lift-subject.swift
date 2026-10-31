// Lifts the foreground subject out of a photo with the Vision framework (the same model as "Lift subject" in Photos), so the glyph
// art keeps the object and drops the room around it. macOS 14 or later.
//
//   lift-subject <in> <out.png>    writes the photo with everything but the subject transparent; exits 2 when there is no subject
import AppKit
import CoreImage
import Vision

let args = CommandLine.arguments
guard args.count == 3, let image = CIImage(contentsOf: URL(fileURLWithPath: args[1])) else {
  FileHandle.standardError.write("usage: lift-subject <in> <out.png>\n".data(using: .utf8)!)
  exit(1)
}
let request = VNGenerateForegroundInstanceMaskRequest()
let handler = VNImageRequestHandler(ciImage: image)
try handler.perform([request])
guard let result = request.results?.first else { exit(2) }
let buffer = try result.generateMaskedImage(ofInstances: result.allInstances, from: handler, croppedToInstancesExtent: false)
try CIContext().writePNGRepresentation(of: CIImage(cvPixelBuffer: buffer), to: URL(fileURLWithPath: args[2]), format: .RGBA8, colorSpace: CGColorSpaceCreateDeviceRGB())
