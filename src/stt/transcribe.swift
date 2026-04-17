import Foundation
import Speech

guard CommandLine.arguments.count > 1 else {
    fputs("Usage: transcribe <audio-file-path>\n", stderr)
    exit(1)
}

let url = URL(fileURLWithPath: CommandLine.arguments[1])

guard let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US")) else {
    fputs("Speech recognizer unavailable\n", stderr)
    exit(1)
}

guard recognizer.isAvailable else {
    fputs("Speech recognizer not available\n", stderr)
    exit(1)
}

let request = SFSpeechURLRecognitionRequest(url: url)
if recognizer.supportsOnDeviceRecognition {
    request.requiresOnDeviceRecognition = true
}

var done = false

recognizer.recognitionTask(with: request) { result, error in
    if let error = error {
        fputs("Recognition error: \(error.localizedDescription)\n", stderr)
        done = true
        return
    }
    if let result = result, result.isFinal {
        print(result.bestTranscription.formattedString)
        done = true
    }
}

let deadline = Date().addingTimeInterval(15)
while !done && Date() < deadline {
    RunLoop.current.run(until: Date().addingTimeInterval(0.1))
}

if !done {
    fputs("Speech recognition timed out\n", stderr)
    exit(1)
}
