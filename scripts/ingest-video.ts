#!/usr/bin/env npx tsx
/**
 * ingest-video.ts — Video Walkthrough Ingestion Engine
 *
 * Takes a video of you walking through a room (talking about what's there),
 * extracts frames + transcribes audio with timestamps, then uses Claude's
 * vision to identify every item visible in each frame — cross-referenced
 * against what you were saying at that moment.
 *
 * Usage:
 *   npx tsx scripts/ingest-video.ts <video-file> [options]
 *
 * Options:
 *   --room <name>         Room name (default: inferred from filename)
 *   --fps <number>        Frames per second to extract (default: 0.5 = one every 2s)
 *   --context-window <s>  Seconds of transcript context before/after each frame (default: 15)
 *   --output <path>       Output JSON path (default: ./ingestion-output/<room>-<timestamp>.json)
 *   --skip-analysis       Skip Claude vision analysis (just extract frames + transcript)
 *   --whisper-model <m>   Whisper model size (default: base, options: tiny/base/small/medium/large)
 *   --dry-run             Show what would happen without actually running
 *
 * Prerequisites:
 *   - ffmpeg installed (brew install ffmpeg)
 *   - Python 3 with openai-whisper (pip install openai-whisper)
 *   - ANTHROPIC_API_KEY env var set (for Claude vision analysis)
 *
 * Output: Structured JSON matching the push-to-supabase.ts format,
 *         ready to pipe directly into the database.
 */

import { execSync, exec } from "child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join, basename, extname, dirname } from "path";
import { randomBytes } from "crypto";

// ============================================================================
// TYPES
// ============================================================================

interface TranscriptSegment {
  id: number;
  start: number;   // seconds
  end: number;      // seconds
  text: string;
}

interface FrameInfo {
  path: string;           // path to extracted frame image
  timestamp: number;      // seconds into video
  timestampFormatted: string; // "M:SS" format
  transcriptContext: string;  // surrounding transcript text
  transcriptWindow: {
    before: string;       // what was said in the N seconds before
    during: string;       // what was being said at this moment
    after: string;        // what was said in the N seconds after
  };
}

interface AnalyzedItem {
  name: string;
  location: string;
  category?: string;
  confidence: "high" | "medium" | "low";
  source: "visual" | "audio" | "both";  // was it seen, mentioned, or both?
}

interface AnalyzedFrame {
  image_path: string;
  timestamp: string;
  transcript_context: string;
  items: AnalyzedItem[];
  scene_description: string;
  storage_units_visible: string[];
}

interface IngestOutput {
  metadata: {
    session_id: string;         // unique ID for this ingestion run
    mode: IngestMode;           // "structural" or "items"
    source_video: string;
    room_name: string;
    duration_seconds: number;
    frames_extracted: number;
    total_items_found: number;
    ingested_at: string;
    whisper_model: string;
    context_window_seconds: number;
  };
  transcript: {
    full_text: string;
    segments: TranscriptSegment[];
  };
  room: {
    name: string;
    icon: string;
    color: string;
    width: number;
    depth: number;
    height: number;
    pos_x: number;
    pos_y: number;
    pos_z: number;
  };
  frames: AnalyzedFrame[];
}

// ============================================================================
// CONFIG & ARGUMENT PARSING
// ============================================================================

type IngestMode = "items" | "structural";

function parseArgs(): {
  videoPath: string;
  roomName: string;
  fps: number;
  contextWindow: number;
  outputPath: string;
  skipAnalysis: boolean;
  whisperModel: string;
  dryRun: boolean;
  mode: IngestMode;
} {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    console.log(`
Video Walkthrough Ingestion Engine
===================================

Usage:
  npx tsx scripts/ingest-video.ts <video-file> [options]

Modes:
  --mode structural       Extract house layout, room dimensions, storage areas
  --mode items            Catalog items in storage (default)

Options:
  --room <name>           Room name (default: from filename)
  --fps <number>          Frames/sec to extract (default: 0.5 = every 2s)
  --context-window <s>    Transcript context seconds (default: 15)
  --output <path>         Output JSON path
  --skip-analysis         Skip Claude analysis, just extract
  --whisper-model <m>     tiny/base/small/medium/large (default: base)
  --dry-run               Preview without running

Prerequisites:
  ffmpeg, python3, openai-whisper, ANTHROPIC_API_KEY
    `);
    process.exit(0);
  }

  const videoPath = args[0];
  let roomName = basename(videoPath, extname(videoPath))
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
  let fps = 0.5;
  let contextWindow = 15;
  let outputPath = "";
  let skipAnalysis = false;
  let whisperModel = "base";
  let dryRun = false;
  let mode: IngestMode = "items";

  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case "--room": roomName = args[++i]; break;
      case "--fps": fps = parseFloat(args[++i]); break;
      case "--context-window": contextWindow = parseInt(args[++i]); break;
      case "--output": outputPath = args[++i]; break;
      case "--skip-analysis": skipAnalysis = true; break;
      case "--whisper-model": whisperModel = args[++i]; break;
      case "--dry-run": dryRun = true; break;
      case "--mode": mode = args[++i] as IngestMode; break;
    }
  }

  if (!outputPath) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const sanitizedRoom = roomName.toLowerCase().replace(/\s+/g, "-");
    const modePrefix = mode === "structural" ? "structure" : sanitizedRoom;
    outputPath = `./ingestion-output/${modePrefix}-${ts}.json`;
  }

  return { videoPath, roomName, fps, contextWindow, outputPath, skipAnalysis, whisperModel, dryRun, mode };
}

// ============================================================================
// STEP 1: CHECK PREREQUISITES
// ============================================================================

function checkPrerequisites(skipAnalysis: boolean): void {
  console.log("\n[1/5] Checking prerequisites...");

  // Check ffmpeg
  try {
    execSync("ffmpeg -version", { stdio: "pipe" });
    console.log("  ✓ ffmpeg found");
  } catch {
    console.error("  ✗ ffmpeg not found. Install with: brew install ffmpeg");
    process.exit(1);
  }

  // Check python3
  try {
    execSync("python3 --version", { stdio: "pipe" });
    console.log("  ✓ python3 found");
  } catch {
    console.error("  ✗ python3 not found");
    process.exit(1);
  }

  // Check whisper
  try {
    execSync("python3 -c 'import whisper'", { stdio: "pipe" });
    console.log("  ✓ openai-whisper found");
  } catch {
    console.error("  ✗ openai-whisper not found. Install with: pip install openai-whisper");
    process.exit(1);
  }

  // Check Anthropic API key (only needed for analysis)
  if (!skipAnalysis) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("  ✗ ANTHROPIC_API_KEY not set. Set it or use --skip-analysis");
      process.exit(1);
    }
    console.log("  ✓ ANTHROPIC_API_KEY set");
  }
}

// ============================================================================
// STEP 2: EXTRACT FRAMES WITH FFMPEG
// ============================================================================

function getVideoDuration(videoPath: string): number {
  const result = execSync(
    `ffprobe -v error -show_entries format=duration -of csv=p=0 "${videoPath}"`,
    { encoding: "utf-8" }
  );
  return parseFloat(result.trim());
}

function extractFrames(videoPath: string, fps: number, workDir: string): string[] {
  console.log("\n[2/5] Extracting frames...");

  const framesDir = join(workDir, "frames");
  mkdirSync(framesDir, { recursive: true });

  const duration = getVideoDuration(videoPath);
  const expectedFrames = Math.ceil(duration * fps);
  console.log(`  Video duration: ${formatTime(duration)}`);
  console.log(`  Extracting at ${fps} fps → ~${expectedFrames} frames`);

  execSync(
    `ffmpeg -i "${videoPath}" -vf "fps=${fps}" -q:v 2 "${framesDir}/frame_%05d.jpg" -y 2>/dev/null`,
    { stdio: "pipe" }
  );

  const files = readdirSync(framesDir)
    .filter(f => f.endsWith(".jpg"))
    .sort()
    .map(f => join(framesDir, f));

  console.log(`  ✓ Extracted ${files.length} frames`);
  return files;
}

// ============================================================================
// STEP 3: TRANSCRIBE AUDIO WITH WHISPER
// ============================================================================

function transcribeAudio(videoPath: string, whisperModel: string, workDir: string): TranscriptSegment[] {
  console.log("\n[3/5] Transcribing audio with Whisper...");
  console.log(`  Model: ${whisperModel}`);

  // Extract audio first
  const audioPath = join(workDir, "audio.wav");
  execSync(
    `ffmpeg -i "${videoPath}" -vn -acodec pcm_s16le -ar 16000 -ac 1 "${audioPath}" -y 2>/dev/null`,
    { stdio: "pipe" }
  );
  console.log("  ✓ Audio extracted");

  // Run Whisper via Python with word-level timestamps
  const whisperScript = join(workDir, "run_whisper.py");
  const outputJson = join(workDir, "transcript.json");

  writeFileSync(whisperScript, `
import whisper
import json
import sys

model = whisper.load_model("${whisperModel}")
result = model.transcribe("${audioPath}", word_timestamps=True)

segments = []
for seg in result["segments"]:
    segments.append({
        "id": seg["id"],
        "start": round(seg["start"], 2),
        "end": round(seg["end"], 2),
        "text": seg["text"].strip(),
    })

output = {
    "full_text": result["text"].strip(),
    "segments": segments,
}

with open("${outputJson}", "w") as f:
    json.dump(output, f, indent=2)

print(f"Transcribed {len(segments)} segments")
`);

  try {
    const result = execSync(`python3 "${whisperScript}"`, { encoding: "utf-8", timeout: 300000 });
    console.log(`  ✓ ${result.trim()}`);
  } catch (err: any) {
    console.error("  ✗ Whisper transcription failed:", err.message);
    process.exit(1);
  }

  const transcript = JSON.parse(readFileSync(outputJson, "utf-8"));
  return transcript.segments;
}

// ============================================================================
// STEP 4: SYNC FRAMES WITH TRANSCRIPT (CONTEXT WINDOW)
// ============================================================================

function syncFramesWithTranscript(
  framePaths: string[],
  segments: TranscriptSegment[],
  fps: number,
  contextWindowSeconds: number
): FrameInfo[] {
  console.log("\n[4/5] Syncing frames with transcript...");
  console.log(`  Context window: ±${contextWindowSeconds}s around each frame`);

  const frameInfos: FrameInfo[] = framePaths.map((path, index) => {
    // Calculate the timestamp for this frame
    const timestamp = index / fps;

    // Find transcript segments within the context window
    const windowStart = Math.max(0, timestamp - contextWindowSeconds);
    const windowEnd = timestamp + contextWindowSeconds;

    const beforeSegments = segments.filter(s => s.start >= windowStart && s.end <= timestamp);
    const duringSegments = segments.filter(s => s.start <= timestamp && s.end >= timestamp);
    const afterSegments = segments.filter(s => s.start >= timestamp && s.start <= windowEnd);

    const before = beforeSegments.map(s => s.text).join(" ");
    const during = duringSegments.map(s => s.text).join(" ");
    const after = afterSegments.map(s => s.text).join(" ");

    // Full context window
    const allInWindow = segments.filter(s =>
      (s.start >= windowStart && s.start <= windowEnd) ||
      (s.end >= windowStart && s.end <= windowEnd)
    );
    const fullContext = allInWindow.map(s => s.text).join(" ");

    return {
      path,
      timestamp,
      timestampFormatted: formatTime(timestamp),
      transcriptContext: fullContext,
      transcriptWindow: { before, during, after },
    };
  });

  console.log(`  ✓ Synced ${frameInfos.length} frames with transcript context`);

  // Show a sample
  if (frameInfos.length > 0) {
    const sample = frameInfos[Math.min(3, frameInfos.length - 1)];
    console.log(`\n  Sample (frame at ${sample.timestampFormatted}):`);
    console.log(`    Speaking at this moment: "${sample.transcriptWindow.during.slice(0, 80)}..."`);
    console.log(`    Full context window: "${sample.transcriptContext.slice(0, 120)}..."`);
  }

  return frameInfos;
}

// ============================================================================
// STEP 5: CLAUDE VISION ANALYSIS
// ============================================================================

async function analyzeFramesWithClaude(
  frames: FrameInfo[],
  roomName: string,
  mode: IngestMode = "items"
): Promise<AnalyzedFrame[]> {
  console.log("\n[5/5] Analyzing frames with Claude Vision...");
  console.log(`  ${frames.length} frames to analyze`);

  const apiKey = process.env.ANTHROPIC_API_KEY!;
  const results: AnalyzedFrame[] = [];

  // Process in batches to avoid rate limits
  const batchSize = 3;
  for (let i = 0; i < frames.length; i += batchSize) {
    const batch = frames.slice(i, i + batchSize);

    const batchPromises = batch.map(async (frame, batchIdx) => {
      const frameNum = i + batchIdx + 1;
      process.stdout.write(`  Analyzing frame ${frameNum}/${frames.length}...`);

      try {
        const imageData = readFileSync(frame.path);
        const base64Image = imageData.toString("base64");

        const prompt = mode === "structural"
          ? buildStructuralPrompt(frame, roomName)
          : buildAnalysisPrompt(frame, roomName);

        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": apiKey,
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 2000,
            messages: [{
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: "image/jpeg",
                    data: base64Image,
                  },
                },
                {
                  type: "text",
                  text: prompt,
                },
              ],
            }],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API error ${response.status}: ${errorText}`);
        }

        const data: any = await response.json();
        const text = data.content[0].text;

        // Parse the structured JSON response
        const jsonMatch = text.match(/```json\n?([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.log(" (no items found)");
          return {
            image_path: frame.path,
            timestamp: frame.timestampFormatted,
            transcript_context: frame.transcriptContext,
            items: [],
            scene_description: text.slice(0, 200),
            storage_units_visible: [],
          };
        }

        const parsed = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        console.log(` ${parsed.items?.length || 0} items`);

        return {
          image_path: frame.path,
          timestamp: frame.timestampFormatted,
          transcript_context: frame.transcriptContext,
          items: parsed.items || [],
          scene_description: parsed.scene_description || "",
          storage_units_visible: parsed.storage_units || [],
        };
      } catch (err: any) {
        console.log(` error: ${err.message.slice(0, 60)}`);
        return {
          image_path: frame.path,
          timestamp: frame.timestampFormatted,
          transcript_context: frame.transcriptContext,
          items: [],
          scene_description: `Analysis failed: ${err.message}`,
          storage_units_visible: [],
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);

    // Rate limit pause between batches
    if (i + batchSize < frames.length) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  const totalItems = results.reduce((sum, r) => sum + r.items.length, 0);
  console.log(`  ✓ Analysis complete: ${totalItems} items found across ${results.length} frames`);

  return results;
}

function buildStructuralPrompt(frame: FrameInfo, roomName: string): string {
  return `You are analyzing a frame from a home walkthrough video. The goal is to map out the STRUCTURE of the house — room dimensions, storage areas, doorways, and spatial layout. Do NOT catalog individual items.

TRANSCRIPT CONTEXT (what the person was saying around this moment):
---
BEFORE (${Math.round(frame.timestamp)}s - previous ~15 seconds):
"${frame.transcriptWindow.before}"

AT THIS MOMENT:
"${frame.transcriptWindow.during}"

AFTER (next ~15 seconds):
"${frame.transcriptWindow.after}"
---

IMPORTANT: Pay close attention to any dimensions, measurements, or spatial descriptions the person mentions ("this room is about 12 by 14", "8 foot ceilings", "the pantry is to the left of the fridge").

Analyze this frame and respond with ONLY a JSON object:

{
  "room_name": "Name of the room visible (or best guess from context)",
  "room_description": "Brief description of the room's shape, feel, and purpose",
  "estimated_dimensions": {
    "width_ft": 0,
    "depth_ft": 0,
    "height_ft": 0,
    "dimension_source": "narrated/estimated/unknown",
    "notes": "Any notes about the measurement (e.g., 'L-shaped, main area only')"
  },
  "storage_areas": [
    {
      "name": "Descriptive name (e.g., 'Upper kitchen cabinets - north wall')",
      "type": "cabinet|shelf|closet|drawer|pantry|garage_shelf|box_stack|built_in|other",
      "position_description": "Where it is relative to the room (e.g., 'along the back wall, left of the doorway')",
      "estimated_size": "small/medium/large/xl",
      "approximate_position": {
        "wall": "north/south/east/west/center/corner",
        "height": "floor/low/mid/high/ceiling"
      },
      "notes": "Any relevant context (e.g., 'temporary — boxes being stored before packing')"
    }
  ],
  "connections": [
    {
      "leads_to": "Room name this connects to",
      "type": "doorway|hallway|open|stairs|arch",
      "position": "Where on the wall (e.g., 'east wall, center')"
    }
  ],
  "features": ["List of notable structural features: windows, islands, columns, alcoves, etc."],
  "notes": "Any other structural observations"
}

Rules:
- Focus on STRUCTURE, not items. We want room shape, dimensions, and storage infrastructure.
- Use the transcript heavily — the person will often state dimensions and describe what connects where.
- For storage areas, be specific about type and position. These will become the containers in our 3D model.
- If you see boxes or temporary storage, still catalog the AREA but note it's temporary.
- Estimate dimensions in feet. Use context clues: door heights (~6.5-7ft), counters (~3ft), standard ceiling (~8-9ft).
- Mark dimension_source as "narrated" if the person stated it, "estimated" if you inferred it, "unknown" if you can't tell.
- One room per frame. If you can see into multiple rooms, focus on the primary one and note connections.`;
}

function buildAnalysisPrompt(frame: FrameInfo, roomName: string): string {
  return `You are analyzing a frame from a home walkthrough video of the "${roomName}".

TRANSCRIPT CONTEXT (what the person was saying around this moment):
---
BEFORE (${Math.round(frame.timestamp)}s - previous ~15 seconds):
"${frame.transcriptWindow.before}"

AT THIS MOMENT:
"${frame.transcriptWindow.during}"

AFTER (next ~15 seconds):
"${frame.transcriptWindow.after}"
---

IMPORTANT: The transcript gives you crucial context about what the person is looking at and describing. Use BOTH what you can see in the image AND what the person is saying to identify items. Sometimes an item is mentioned in speech but partially hidden in the frame, or visible but not mentioned — capture both.

Analyze this frame and respond with ONLY a JSON object (no markdown fences needed):

{
  "scene_description": "Brief description of what's visible in this area of the room",
  "storage_units": ["List of cabinets, shelves, boxes, drawers, closets visible"],
  "items": [
    {
      "name": "Item name",
      "location": "Where exactly it is (e.g., 'top shelf of metal shelving unit, left side')",
      "category": "Category (e.g., 'Tools', 'Kitchen', 'Holiday', 'Electronics', etc.)",
      "confidence": "high/medium/low",
      "source": "visual/audio/both"
    }
  ]
}

Rules:
- List EVERY identifiable item, even partially visible ones
- Use the transcript to identify items that are mentioned but hard to see
- "source": "visual" = you can see it; "audio" = person mentioned it; "both" = visible AND mentioned
- Be specific about locations (not just "on shelf" but "second shelf from top, right side")
- Include storage containers themselves as items (boxes, bins, baskets)
- If the person mentions putting something somewhere or describes contents, include those items
- Confidence: "high" = clearly visible/stated, "medium" = partially visible or inferred, "low" = guessing from context`;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║  Home Navigator — Video Ingestion Engine ║");
  console.log("╚══════════════════════════════════════════╝");

  const config = parseArgs();

  if (!existsSync(config.videoPath)) {
    console.error(`\nError: Video file not found: ${config.videoPath}`);
    process.exit(1);
  }

  // Generate a unique session ID for this ingestion run
  const sessionId = `ingest-${Date.now()}-${randomBytes(4).toString("hex")}`;

  console.log(`\n  Session:  ${sessionId}`);
  console.log(`  Mode:     ${config.mode.toUpperCase()}${config.mode === "structural" ? " (house layout + storage areas)" : " (cataloging items)"}`);
  console.log(`  Video:    ${config.videoPath}`);
  console.log(`  Room:     ${config.roomName}`);
  console.log(`  FPS:      ${config.fps} (1 frame every ${1 / config.fps}s)`);
  console.log(`  Context:  ±${config.contextWindow}s transcript window`);
  console.log(`  Output:   ${config.outputPath}`);

  if (config.dryRun) {
    console.log("\n  [DRY RUN] Would execute the above. Exiting.");
    process.exit(0);
  }

  // Create work directory
  const workDir = join(dirname(config.outputPath), ".ingest-work");
  mkdirSync(workDir, { recursive: true });
  mkdirSync(dirname(config.outputPath), { recursive: true });

  // Step 1: Prerequisites
  checkPrerequisites(config.skipAnalysis);

  // Step 2: Extract frames
  const framePaths = extractFrames(config.videoPath, config.fps, workDir);

  // Step 3: Transcribe
  const segments = transcribeAudio(config.videoPath, config.whisperModel, workDir);
  const fullText = segments.map(s => s.text).join(" ");

  // Step 4: Sync frames ↔ transcript
  const frameInfos = syncFramesWithTranscript(
    framePaths, segments, config.fps, config.contextWindow
  );

  // Step 5: Claude Vision analysis (unless skipped)
  let analyzedFrames: AnalyzedFrame[];

  if (config.skipAnalysis) {
    console.log("\n[5/5] Skipping Claude analysis (--skip-analysis)");
    analyzedFrames = frameInfos.map(f => ({
      image_path: f.path,
      timestamp: f.timestampFormatted,
      transcript_context: f.transcriptContext,
      items: [],
      scene_description: "",
      storage_units_visible: [],
    }));
  } else {
    analyzedFrames = await analyzeFramesWithClaude(frameInfos, config.roomName, config.mode);
  }

  // Build output
  const duration = getVideoDuration(config.videoPath);
  const totalItems = analyzedFrames.reduce((s, f) => s + f.items.length, 0);

  const output: IngestOutput = {
    metadata: {
      session_id: sessionId,
      mode: config.mode,
      source_video: config.videoPath,
      room_name: config.roomName,
      duration_seconds: duration,
      frames_extracted: framePaths.length,
      total_items_found: totalItems,
      ingested_at: new Date().toISOString(),
      whisper_model: config.whisperModel,
      context_window_seconds: config.contextWindow,
    },
    transcript: {
      full_text: fullText,
      segments,
    },
    room: {
      name: config.roomName,
      icon: config.roomName[0].toUpperCase(),
      color: "#4a5568",
      width: 5,
      depth: 4,
      height: 2.8,
      pos_x: 0,
      pos_y: 0,
      pos_z: 0,
    },
    frames: analyzedFrames,
  };

  writeFileSync(config.outputPath, JSON.stringify(output, null, 2));

  console.log("\n══════════════════════════════════════════");
  console.log(`  ✓ Ingestion complete!`);
  console.log(`    Session:     ${sessionId}`);
  console.log(`    Mode:        ${config.mode}`);
  console.log(`    Room:        ${config.roomName}`);
  console.log(`    Duration:    ${formatTime(duration)}`);
  console.log(`    Frames:      ${framePaths.length}`);
  console.log(`    Items found: ${totalItems}`);
  console.log(`    Output:      ${config.outputPath}`);
  console.log("══════════════════════════════════════════");

  if (config.mode === "structural") {
    console.log(`\n  Next steps:`);
    console.log(`  1. Review the structural output JSON`);
    console.log(`  2. The data contains room dimensions, storage areas, and connections`);
    console.log(`  3. Feed this to the 3D model builder to update the house layout`);
    console.log(`  4. Then do item-cataloging runs per room:`);
    console.log(`     npx tsx scripts/ingest-video.ts <room-video> --room "Kitchen" --mode items\n`);
  } else {
    console.log(`\n  Next steps:`);
    console.log(`  1. Merge into master inventory:`);
    console.log(`     npx tsx scripts/merge-inventory.ts ${config.outputPath}`);
    console.log(`  2. Push to Supabase:`);
    console.log(`     npx tsx scripts/push-to-supabase.ts ${config.outputPath}\n`);
  }
}

main().catch(err => {
  console.error("\nFatal error:", err);
  process.exit(1);
});
