// Subject-lifting matte for the hero portrait (macOS 14+, Vision). Writes an 8-bit greyscale PNG, white = person.
// Usage: swift scripts/portrait-matte.swift <input image> <output matte.png>
// Then: node scripts/build-portrait.mjs <input image> <matte.png>   (builds the committed texture)
import Foundation
import Vision
import CoreImage
import AppKit

let args = CommandLine.arguments
guard args.count == 3 else {
    FileHandle.standardError.write("usage: portrait-matte.swift <in> <out.png>\n".data(using: .utf8)!)
    exit(2)
}
guard let nsImage = NSImage(contentsOfFile: args[1]),
      let cg = nsImage.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("cannot read image\n".data(using: .utf8)!)
    exit(1)
}
let handler = VNImageRequestHandler(cgImage: cg, options: [:])
let request = VNGenerateForegroundInstanceMaskRequest()
try handler.perform([request])
guard let result = request.results?.first else {
    FileHandle.standardError.write("no foreground found\n".data(using: .utf8)!)
    exit(1)
}
let mask = try result.generateScaledMaskForImage(forInstances: result.allInstances, from: handler)
let ci = CIImage(cvPixelBuffer: mask)
let ctx = CIContext()
guard let out = ctx.createCGImage(ci, from: ci.extent, format: .L8, colorSpace: CGColorSpaceCreateDeviceGray()) else { exit(1) }
let rep = NSBitmapImageRep(cgImage: out)
try rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: args[2]))
print("wrote \(args[2]) \(out.width)x\(out.height)")
