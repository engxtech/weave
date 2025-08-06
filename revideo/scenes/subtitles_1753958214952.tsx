
import { Audio, Img, makeScene2D, Txt, Rect, Layout } from '@revideo/2d';
import { all, createRef, waitFor, useScene, Reference, createSignal } from '@revideo/core';

interface Word {
  punctuated_word: string;
  start: number;
  end: number;
}

interface CaptionSettings {
  fontSize: number;
  textColor: string;
  fontWeight: number;
  fontFamily: string;
  numSimultaneousWords: number;
  stream: boolean;
  textAlign: "center" | "left";
  textBoxWidthInPercent: number;
  borderColor?: string;
  borderWidth?: number;
  currentWordColor?: string;
  currentWordBackgroundColor?: string;
  shadowColor?: string;
  shadowBlur?: number;
  fadeInAnimation?: boolean;
}

const textSettings: CaptionSettings = {
  "fontSize": 80,
  "numSimultaneousWords": 6,
  "textColor": "white",
  "fontWeight": 800,
  "fontFamily": "Arial",
  "stream": false,
  "textAlign": "center",
  "textBoxWidthInPercent": 95,
  "fadeInAnimation": true,
  "currentWordColor": "cyan",
  "currentWordBackgroundColor": "red",
  "shadowColor": "black",
  "shadowBlur": 30,
  "borderColor": "black",
  "borderWidth": 2,
  "style": "bold"
};

export default makeScene2D(function* (view) {
  const words: Word[] = [
  {
    "punctuated_word": "Bet",
    "start": 0.71999997,
    "end": 1.04
  },
  {
    "punctuated_word": "on",
    "start": 1.04,
    "end": 1.28
  },
  {
    "punctuated_word": "this",
    "start": 1.28,
    "end": 1.78
  },
  {
    "punctuated_word": "tech",
    "start": 2.1599998,
    "end": 2.3999999
  },
  {
    "punctuated_word": "trend.",
    "start": 2.3999999,
    "end": 2.72
  },
  {
    "punctuated_word": "Like,",
    "start": 2.72,
    "end": 2.96
  },
  {
    "punctuated_word": "bet",
    "start": 2.96,
    "end": 3.12
  },
  {
    "punctuated_word": "on",
    "start": 3.12,
    "end": 3.28
  },
  {
    "punctuated_word": "this",
    "start": 3.28,
    "end": 3.52
  },
  {
    "punctuated_word": "trend.",
    "start": 3.52,
    "end": 3.84
  },
  {
    "punctuated_word": "It's",
    "start": 3.84,
    "end": 4.16
  },
  {
    "punctuated_word": "this",
    "start": 4.24,
    "end": 4.48
  },
  {
    "punctuated_word": "is",
    "start": 4.48,
    "end": 4.64
  },
  {
    "punctuated_word": "we",
    "start": 4.88,
    "end": 5.12
  },
  {
    "punctuated_word": "are",
    "start": 5.12,
    "end": 5.2799997
  },
  {
    "punctuated_word": "not",
    "start": 5.2799997,
    "end": 5.52
  },
  {
    "punctuated_word": "near",
    "start": 5.52,
    "end": 5.7599998
  },
  {
    "punctuated_word": "the",
    "start": 5.7599998,
    "end": 5.92
  },
  {
    "punctuated_word": "saturation",
    "start": 5.92,
    "end": 6.42
  },
  {
    "punctuated_word": "point.",
    "start": 6.48,
    "end": 6.8799996
  },
  {
    "punctuated_word": "The",
    "start": 6.8799996,
    "end": 7.12
  },
  {
    "punctuated_word": "models",
    "start": 7.12,
    "end": 7.3599997
  },
  {
    "punctuated_word": "are",
    "start": 7.3599997,
    "end": 7.44
  },
  {
    "punctuated_word": "gonna",
    "start": 7.44,
    "end": 7.68
  },
  {
    "punctuated_word": "get",
    "start": 7.68,
    "end": 8
  },
  {
    "punctuated_word": "so",
    "start": 8,
    "end": 8.08
  },
  {
    "punctuated_word": "much",
    "start": 8.08,
    "end": 8.32
  },
  {
    "punctuated_word": "better",
    "start": 8.32,
    "end": 8.639999
  },
  {
    "punctuated_word": "so",
    "start": 8.639999,
    "end": 8.8
  },
  {
    "punctuated_word": "quickly.",
    "start": 8.8,
    "end": 9.3
  },
  {
    "punctuated_word": "What",
    "start": 9.44,
    "end": 9.599999
  },
  {
    "punctuated_word": "you",
    "start": 9.599999,
    "end": 9.76
  },
  {
    "punctuated_word": "can",
    "start": 9.76,
    "end": 9.92
  },
  {
    "punctuated_word": "do",
    "start": 9.92,
    "end": 10.08
  },
  {
    "punctuated_word": "as",
    "start": 10.08,
    "end": 10.24
  },
  {
    "punctuated_word": "a",
    "start": 10.24,
    "end": 10.4
  },
  {
    "punctuated_word": "startup",
    "start": 10.4,
    "end": 10.719999
  },
  {
    "punctuated_word": "founder",
    "start": 10.719999,
    "end": 11.04
  },
  {
    "punctuated_word": "with",
    "start": 11.04,
    "end": 11.2
  },
  {
    "punctuated_word": "this",
    "start": 11.2,
    "end": 11.7
  },
  {
    "punctuated_word": "versus",
    "start": 11.92,
    "end": 12.32
  },
  {
    "punctuated_word": "what",
    "start": 12.32,
    "end": 12.82
  },
  {
    "punctuated_word": "you",
    "start": 12.88,
    "end": 13.04
  },
  {
    "punctuated_word": "could",
    "start": 13.04,
    "end": 13.2
  },
  {
    "punctuated_word": "do",
    "start": 13.2,
    "end": 13.36
  },
  {
    "punctuated_word": "without",
    "start": 13.36,
    "end": 13.599999
  },
  {
    "punctuated_word": "it",
    "start": 13.599999,
    "end": 13.84
  },
  {
    "punctuated_word": "is",
    "start": 13.84,
    "end": 14
  },
  {
    "punctuated_word": "so",
    "start": 14,
    "end": 14.16
  },
  {
    "punctuated_word": "wildly",
    "start": 14.16,
    "end": 14.559999
  },
  {
    "punctuated_word": "different.",
    "start": 14.559999,
    "end": 15.059999
  },
  {
    "punctuated_word": "And",
    "start": 15.12,
    "end": 15.62
  },
  {
    "punctuated_word": "the",
    "start": 16.155,
    "end": 16.315
  },
  {
    "punctuated_word": "big",
    "start": 16.315,
    "end": 16.555
  },
  {
    "punctuated_word": "companies,",
    "start": 16.555,
    "end": 17.055
  },
  {
    "punctuated_word": "even",
    "start": 17.115,
    "end": 17.275
  },
  {
    "punctuated_word": "the",
    "start": 17.275,
    "end": 17.435
  },
  {
    "punctuated_word": "medium",
    "start": 17.435,
    "end": 17.755
  },
  {
    "punctuated_word": "sized",
    "start": 17.755,
    "end": 17.994999
  },
  {
    "punctuated_word": "companies,",
    "start": 17.994999,
    "end": 18.395
  },
  {
    "punctuated_word": "even",
    "start": 18.395,
    "end": 18.555
  },
  {
    "punctuated_word": "the",
    "start": 18.555,
    "end": 18.635
  },
  {
    "punctuated_word": "startups",
    "start": 18.635,
    "end": 19.035
  },
  {
    "punctuated_word": "that",
    "start": 19.035,
    "end": 19.115
  },
  {
    "punctuated_word": "are",
    "start": 19.115,
    "end": 19.195
  },
  {
    "punctuated_word": "a",
    "start": 19.195,
    "end": 19.275
  },
  {
    "punctuated_word": "few",
    "start": 19.275,
    "end": 19.435
  },
  {
    "punctuated_word": "years",
    "start": 19.435,
    "end": 19.595
  },
  {
    "punctuated_word": "old,",
    "start": 19.595,
    "end": 19.994999
  },
  {
    "punctuated_word": "they're",
    "start": 19.994999,
    "end": 20.235
  },
  {
    "punctuated_word": "already",
    "start": 20.235,
    "end": 20.475
  },
  {
    "punctuated_word": "on,",
    "start": 20.475,
    "end": 20.715
  },
  {
    "punctuated_word": "like,",
    "start": 20.715,
    "end": 20.955
  },
  {
    "punctuated_word": "quarterly",
    "start": 20.955,
    "end": 21.355
  },
  {
    "punctuated_word": "planning",
    "start": 21.355,
    "end": 21.675
  },
  {
    "punctuated_word": "cycles.",
    "start": 21.675,
    "end": 22.175
  },
  {
    "punctuated_word": "And",
    "start": 22.475,
    "end": 22.875
  },
  {
    "punctuated_word": "Google",
    "start": 22.875,
    "end": 23.275
  },
  {
    "punctuated_word": "is",
    "start": 23.275,
    "end": 23.435
  },
  {
    "punctuated_word": "on",
    "start": 23.435,
    "end": 23.935
  },
  {
    "punctuated_word": "a",
    "start": 24.075,
    "end": 24.154999
  },
  {
    "punctuated_word": "year",
    "start": 24.154999,
    "end": 24.395
  },
  {
    "punctuated_word": "or",
    "start": 24.395,
    "end": 24.474998
  },
  {
    "punctuated_word": "decade",
    "start": 24.474998,
    "end": 24.795
  },
  {
    "punctuated_word": "planning",
    "start": 24.795,
    "end": 25.035
  },
  {
    "punctuated_word": "cycle.",
    "start": 25.035,
    "end": 25.154999
  },
  {
    "punctuated_word": "I",
    "start": 25.154999,
    "end": 25.275
  },
  {
    "punctuated_word": "don't",
    "start": 25.275,
    "end": 25.515
  },
  {
    "punctuated_word": "know",
    "start": 25.515,
    "end": 25.595
  },
  {
    "punctuated_word": "how",
    "start": 25.595,
    "end": 25.755001
  },
  {
    "punctuated_word": "they",
    "start": 25.755001,
    "end": 25.915
  },
  {
    "punctuated_word": "even",
    "start": 25.915,
    "end": 26.075
  },
  {
    "punctuated_word": "do",
    "start": 26.075,
    "end": 26.235
  },
  {
    "punctuated_word": "it",
    "start": 26.235,
    "end": 26.395
  },
  {
    "punctuated_word": "anymore.",
    "start": 26.395,
    "end": 26.895
  },
  {
    "punctuated_word": "But",
    "start": 26.955,
    "end": 27.455
  },
  {
    "punctuated_word": "your",
    "start": 27.595,
    "end": 27.915
  },
  {
    "punctuated_word": "advantage",
    "start": 27.915,
    "end": 28.415
  },
  {
    "punctuated_word": "with",
    "start": 28.715,
    "end": 29.215
  },
  {
    "punctuated_word": "speed",
    "start": 29.57,
    "end": 29.89
  },
  {
    "punctuated_word": "and",
    "start": 29.89,
    "end": 30.13
  },
  {
    "punctuated_word": "focus",
    "start": 30.13,
    "end": 30.45
  },
  {
    "punctuated_word": "and",
    "start": 30.45,
    "end": 30.61
  },
  {
    "punctuated_word": "conviction",
    "start": 30.61,
    "end": 31.09
  },
  {
    "punctuated_word": "and",
    "start": 31.09,
    "end": 31.25
  },
  {
    "punctuated_word": "the",
    "start": 31.25,
    "end": 31.41
  },
  {
    "punctuated_word": "ability",
    "start": 31.41,
    "end": 31.81
  },
  {
    "punctuated_word": "to",
    "start": 31.81,
    "end": 32.309998
  },
  {
    "punctuated_word": "react",
    "start": 32.37,
    "end": 32.69
  },
  {
    "punctuated_word": "to",
    "start": 32.69,
    "end": 32.85
  },
  {
    "punctuated_word": "how",
    "start": 32.85,
    "end": 33.01
  },
  {
    "punctuated_word": "fast",
    "start": 33.01,
    "end": 33.25
  },
  {
    "punctuated_word": "the",
    "start": 33.25,
    "end": 33.33
  },
  {
    "punctuated_word": "technology",
    "start": 33.33,
    "end": 33.81
  },
  {
    "punctuated_word": "is",
    "start": 33.81,
    "end": 33.97
  },
  {
    "punctuated_word": "moving,",
    "start": 33.97,
    "end": 34.47
  },
  {
    "punctuated_word": "that",
    "start": 34.85,
    "end": 35.09
  },
  {
    "punctuated_word": "is",
    "start": 35.09,
    "end": 35.33
  },
  {
    "punctuated_word": "that",
    "start": 35.33,
    "end": 35.489998
  },
  {
    "punctuated_word": "is",
    "start": 35.489998,
    "end": 35.65
  },
  {
    "punctuated_word": "the",
    "start": 35.65,
    "end": 35.81
  },
  {
    "punctuated_word": "number",
    "start": 35.81,
    "end": 36.13
  },
  {
    "punctuated_word": "1",
    "start": 36.13,
    "end": 36.29
  },
  {
    "punctuated_word": "edge",
    "start": 36.29,
    "end": 36.53
  },
  {
    "punctuated_word": "of",
    "start": 36.53,
    "end": 36.61
  },
  {
    "punctuated_word": "a",
    "start": 36.61,
    "end": 36.77
  },
  {
    "punctuated_word": "start",
    "start": 36.77,
    "end": 37.01
  },
  {
    "punctuated_word": "up",
    "start": 37.01,
    "end": 37.51
  },
  {
    "punctuated_word": "kinda",
    "start": 38.13,
    "end": 38.45
  },
  {
    "punctuated_word": "ever,",
    "start": 38.45,
    "end": 38.95
  },
  {
    "punctuated_word": "but",
    "start": 39.17,
    "end": 39.65
  },
  {
    "punctuated_word": "especially",
    "start": 39.65,
    "end": 40.15
  },
  {
    "punctuated_word": "right",
    "start": 40.21,
    "end": 40.37
  },
  {
    "punctuated_word": "now.",
    "start": 40.37,
    "end": 40.87
  },
  {
    "punctuated_word": "So",
    "start": 41.01,
    "end": 41.51
  },
  {
    "punctuated_word": "I",
    "start": 41.955,
    "end": 42.115
  },
  {
    "punctuated_word": "would",
    "start": 42.115,
    "end": 42.435
  },
  {
    "punctuated_word": "definitely,",
    "start": 42.435,
    "end": 42.935
  },
  {
    "punctuated_word": "like,",
    "start": 42.995,
    "end": 43.235
  },
  {
    "punctuated_word": "build",
    "start": 43.235,
    "end": 43.475
  },
  {
    "punctuated_word": "something",
    "start": 43.475,
    "end": 43.715
  },
  {
    "punctuated_word": "with",
    "start": 43.715,
    "end": 44.035
  },
  {
    "punctuated_word": "AI,",
    "start": 44.035,
    "end": 44.275
  },
  {
    "punctuated_word": "and",
    "start": 44.275,
    "end": 44.435
  },
  {
    "punctuated_word": "I",
    "start": 44.435,
    "end": 44.515
  },
  {
    "punctuated_word": "would",
    "start": 44.515,
    "end": 44.675
  },
  {
    "punctuated_word": "definitely,",
    "start": 44.675,
    "end": 45.075
  },
  {
    "punctuated_word": "like,",
    "start": 45.075,
    "end": 45.235
  },
  {
    "punctuated_word": "take",
    "start": 45.235,
    "end": 45.475
  },
  {
    "punctuated_word": "advantage",
    "start": 45.475,
    "end": 45.955
  },
  {
    "punctuated_word": "of",
    "start": 45.955,
    "end": 46.455
  },
  {
    "punctuated_word": "the",
    "start": 46.595,
    "end": 46.755
  },
  {
    "punctuated_word": "ability",
    "start": 46.755,
    "end": 47.235
  },
  {
    "punctuated_word": "to",
    "start": 47.235,
    "end": 47.735
  },
  {
    "punctuated_word": "see",
    "start": 47.795,
    "end": 48.035
  },
  {
    "punctuated_word": "a",
    "start": 48.035,
    "end": 48.195
  },
  {
    "punctuated_word": "new",
    "start": 48.195,
    "end": 48.275
  },
  {
    "punctuated_word": "thing",
    "start": 48.275,
    "end": 48.515
  },
  {
    "punctuated_word": "and",
    "start": 48.515,
    "end": 48.675
  },
  {
    "punctuated_word": "build",
    "start": 48.675,
    "end": 48.915
  },
  {
    "punctuated_word": "something",
    "start": 48.915,
    "end": 49.235
  },
  {
    "punctuated_word": "that",
    "start": 49.235,
    "end": 49.395
  },
  {
    "punctuated_word": "day",
    "start": 49.395,
    "end": 49.715
  },
  {
    "punctuated_word": "rather",
    "start": 49.715,
    "end": 50.035
  },
  {
    "punctuated_word": "than,",
    "start": 50.035,
    "end": 50.195
  },
  {
    "punctuated_word": "like,",
    "start": 50.195,
    "end": 50.435
  },
  {
    "punctuated_word": "put",
    "start": 50.435,
    "end": 50.595
  },
  {
    "punctuated_word": "it",
    "start": 50.595,
    "end": 50.675
  },
  {
    "punctuated_word": "into",
    "start": 50.675,
    "end": 51.075
  },
  {
    "punctuated_word": "a",
    "start": 51.075,
    "end": 51.395
  },
  {
    "punctuated_word": "quarterly",
    "start": 51.395,
    "end": 51.875
  },
  {
    "punctuated_word": "planning",
    "start": 51.875,
    "end": 52.195
  },
  {
    "punctuated_word": "cycle.",
    "start": 52.195,
    "end": 52.695
  },
  {
    "punctuated_word": "I",
    "start": 53.475,
    "end": 53.555
  },
  {
    "punctuated_word": "guess",
    "start": 53.555,
    "end": 53.795
  },
  {
    "punctuated_word": "the",
    "start": 53.795,
    "end": 53.955
  },
  {
    "punctuated_word": "other",
    "start": 53.955,
    "end": 54.114998
  },
  {
    "punctuated_word": "thing",
    "start": 54.114998,
    "end": 54.355
  },
  {
    "punctuated_word": "I",
    "start": 54.355,
    "end": 54.434998
  },
  {
    "punctuated_word": "would",
    "start": 54.434998,
    "end": 54.595
  },
  {
    "punctuated_word": "say",
    "start": 54.595,
    "end": 54.915
  },
  {
    "punctuated_word": "is",
    "start": 54.915,
    "end": 55.415
  },
  {
    "punctuated_word": "it",
    "start": 57.13,
    "end": 57.29
  },
  {
    "punctuated_word": "is",
    "start": 57.29,
    "end": 57.61
  },
  {
    "punctuated_word": "easy",
    "start": 57.61,
    "end": 57.85
  },
  {
    "punctuated_word": "when",
    "start": 57.85,
    "end": 58.09
  },
  {
    "punctuated_word": "there's",
    "start": 58.09,
    "end": 58.25
  },
  {
    "punctuated_word": "a",
    "start": 58.25,
    "end": 58.41
  },
  {
    "punctuated_word": "new",
    "start": 58.41,
    "end": 58.57
  },
  {
    "punctuated_word": "technology",
    "start": 58.57,
    "end": 59.05
  },
  {
    "punctuated_word": "platform",
    "start": 59.05,
    "end": 59.55
  },
  {
    "punctuated_word": "to",
    "start": 60.33,
    "end": 60.489998
  },
  {
    "punctuated_word": "say,",
    "start": 60.489998,
    "end": 60.65
  },
  {
    "punctuated_word": "well,",
    "start": 60.65,
    "end": 60.81
  },
  {
    "punctuated_word": "because",
    "start": 60.81,
    "end": 61.05
  },
  {
    "punctuated_word": "I'm",
    "start": 61.05,
    "end": 61.13
  },
  {
    "punctuated_word": "doing",
    "start": 61.13,
    "end": 61.37
  },
  {
    "punctuated_word": "some",
    "start": 61.37,
    "end": 61.53
  },
  {
    "punctuated_word": "of",
    "start": 61.53,
    "end": 61.61
  },
  {
    "punctuated_word": "the",
    "start": 61.61,
    "end": 61.85
  },
  {
    "punctuated_word": "AI,",
    "start": 61.85,
    "end": 62.35
  },
  {
    "punctuated_word": "the",
    "start": 62.65,
    "end": 63.15
  },
  {
    "punctuated_word": "the",
    "start": 63.21,
    "end": 63.37
  },
  {
    "punctuated_word": "rule",
    "start": 63.37,
    "end": 63.53
  },
  {
    "punctuated_word": "the",
    "start": 63.69,
    "end": 64.09
  },
  {
    "punctuated_word": "laws",
    "start": 64.09,
    "end": 64.41
  },
  {
    "punctuated_word": "of",
    "start": 64.41,
    "end": 64.729996
  },
  {
    "punctuated_word": "business",
    "start": 64.729996,
    "end": 65.13
  },
  {
    "punctuated_word": "don't",
    "start": 65.13,
    "end": 65.37
  },
  {
    "punctuated_word": "apply",
    "start": 65.37,
    "end": 65.61
  },
  {
    "punctuated_word": "to",
    "start": 65.61,
    "end": 65.69
  },
  {
    "punctuated_word": "me.",
    "start": 65.69,
    "end": 66.01
  },
  {
    "punctuated_word": "I",
    "start": 66.01,
    "end": 66.17
  },
  {
    "punctuated_word": "have",
    "start": 66.17,
    "end": 66.41
  },
  {
    "punctuated_word": "this",
    "start": 66.41,
    "end": 66.57
  },
  {
    "punctuated_word": "magic",
    "start": 66.57,
    "end": 66.97
  },
  {
    "punctuated_word": "technology,",
    "start": 66.97,
    "end": 67.37
  },
  {
    "punctuated_word": "and",
    "start": 67.37,
    "end": 67.53
  },
  {
    "punctuated_word": "so",
    "start": 67.53,
    "end": 67.77
  },
  {
    "punctuated_word": "I",
    "start": 67.77,
    "end": 67.93
  },
  {
    "punctuated_word": "don't",
    "start": 67.93,
    "end": 68.09
  },
  {
    "punctuated_word": "have",
    "start": 68.09,
    "end": 68.25
  },
  {
    "punctuated_word": "to",
    "start": 68.25,
    "end": 68.33
  },
  {
    "punctuated_word": "build,",
    "start": 68.33,
    "end": 68.83
  },
  {
    "punctuated_word": "a",
    "start": 70.475,
    "end": 70.635
  },
  {
    "punctuated_word": "moat",
    "start": 70.635,
    "end": 71.034996
  },
  {
    "punctuated_word": "or",
    "start": 71.034996,
    "end": 71.354996
  },
  {
    "punctuated_word": "a,",
    "start": 71.354996,
    "end": 71.835
  },
  {
    "punctuated_word": "you",
    "start": 72.235,
    "end": 72.475
  },
  {
    "punctuated_word": "know,",
    "start": 72.475,
    "end": 72.795
  },
  {
    "punctuated_word": "competitive",
    "start": 72.795,
    "end": 73.295
  },
  {
    "punctuated_word": "edge",
    "start": 73.354996,
    "end": 73.515
  },
  {
    "punctuated_word": "or",
    "start": 73.515,
    "end": 73.674995
  },
  {
    "punctuated_word": "a",
    "start": 73.674995,
    "end": 73.755
  },
  {
    "punctuated_word": "better",
    "start": 73.755,
    "end": 73.994995
  },
  {
    "punctuated_word": "product.",
    "start": 73.994995,
    "end": 74.395
  },
  {
    "punctuated_word": "It's",
    "start": 74.395,
    "end": 74.475
  },
  {
    "punctuated_word": "because,",
    "start": 74.475,
    "end": 74.715
  },
  {
    "punctuated_word": "you",
    "start": 74.715,
    "end": 74.795
  },
  {
    "punctuated_word": "know,",
    "start": 74.795,
    "end": 75.034996
  },
  {
    "punctuated_word": "I'm",
    "start": 75.034996,
    "end": 75.195
  },
  {
    "punctuated_word": "doing",
    "start": 75.195,
    "end": 75.435
  },
  {
    "punctuated_word": "AI",
    "start": 75.435,
    "end": 75.595
  },
  {
    "punctuated_word": "and",
    "start": 75.595,
    "end": 75.755
  },
  {
    "punctuated_word": "you're",
    "start": 75.755,
    "end": 75.915
  },
  {
    "punctuated_word": "not,",
    "start": 75.915,
    "end": 76.155
  },
  {
    "punctuated_word": "so",
    "start": 76.155,
    "end": 76.395
  },
  {
    "punctuated_word": "that's",
    "start": 76.395,
    "end": 76.635
  },
  {
    "punctuated_word": "all",
    "start": 76.635,
    "end": 76.715
  },
  {
    "punctuated_word": "I",
    "start": 76.715,
    "end": 76.795
  },
  {
    "punctuated_word": "need.",
    "start": 76.795,
    "end": 77.295
  },
  {
    "punctuated_word": "And",
    "start": 77.435,
    "end": 77.674995
  },
  {
    "punctuated_word": "that's",
    "start": 77.674995,
    "end": 77.915
  },
  {
    "punctuated_word": "obviously",
    "start": 77.915,
    "end": 78.415
  },
  {
    "punctuated_word": "not",
    "start": 78.475,
    "end": 78.715
  },
  {
    "punctuated_word": "true.",
    "start": 78.715,
    "end": 79.215
  },
  {
    "punctuated_word": "But",
    "start": 79.515,
    "end": 79.915
  },
  {
    "punctuated_word": "what",
    "start": 79.915,
    "end": 80.155
  },
  {
    "punctuated_word": "you",
    "start": 80.155,
    "end": 80.315
  },
  {
    "punctuated_word": "can",
    "start": 80.315,
    "end": 80.555
  },
  {
    "punctuated_word": "get",
    "start": 80.555,
    "end": 80.795
  },
  {
    "punctuated_word": "are",
    "start": 80.795,
    "end": 80.955
  },
  {
    "punctuated_word": "these",
    "start": 80.955,
    "end": 81.195
  },
  {
    "punctuated_word": "short",
    "start": 81.195,
    "end": 81.435
  },
  {
    "punctuated_word": "term",
    "start": 81.435,
    "end": 81.935
  },
  {
    "punctuated_word": "explosions",
    "start": 82.89001,
    "end": 83.37
  },
  {
    "punctuated_word": "of",
    "start": 83.37,
    "end": 83.53001
  },
  {
    "punctuated_word": "growth",
    "start": 83.53001,
    "end": 84.03001
  },
  {
    "punctuated_word": "by",
    "start": 84.33,
    "end": 84.83
  },
  {
    "punctuated_word": "embracing",
    "start": 85.05,
    "end": 85.450005
  },
  {
    "punctuated_word": "a",
    "start": 85.450005,
    "end": 85.53001
  },
  {
    "punctuated_word": "new",
    "start": 85.53001,
    "end": 85.770004
  },
  {
    "punctuated_word": "technology",
    "start": 85.770004,
    "end": 86.270004
  },
  {
    "punctuated_word": "more",
    "start": 86.33,
    "end": 86.490005
  },
  {
    "punctuated_word": "quickly",
    "start": 86.490005,
    "end": 86.73
  },
  {
    "punctuated_word": "than",
    "start": 86.73,
    "end": 86.89001
  },
  {
    "punctuated_word": "somebody",
    "start": 86.89001,
    "end": 87.21001
  },
  {
    "punctuated_word": "else.",
    "start": 87.21001,
    "end": 87.71001
  },
  {
    "punctuated_word": "And",
    "start": 88.73,
    "end": 89.23
  },
  {
    "punctuated_word": "remembering",
    "start": 89.93,
    "end": 90.43
  },
  {
    "punctuated_word": "not",
    "start": 90.490005,
    "end": 90.65
  },
  {
    "punctuated_word": "to",
    "start": 90.65,
    "end": 90.73
  },
  {
    "punctuated_word": "fall",
    "start": 90.73,
    "end": 90.89
  },
  {
    "punctuated_word": "for",
    "start": 90.89,
    "end": 91.05
  },
  {
    "punctuated_word": "that",
    "start": 91.05,
    "end": 91.130005
  },
  {
    "punctuated_word": "and",
    "start": 91.130005,
    "end": 91.29
  },
  {
    "punctuated_word": "that",
    "start": 91.29,
    "end": 91.450005
  },
  {
    "punctuated_word": "you",
    "start": 91.450005,
    "end": 91.53001
  },
  {
    "punctuated_word": "still",
    "start": 91.53001,
    "end": 91.770004
  },
  {
    "punctuated_word": "have",
    "start": 91.770004,
    "end": 91.850006
  },
  {
    "punctuated_word": "to",
    "start": 91.850006,
    "end": 91.93
  },
  {
    "punctuated_word": "build",
    "start": 91.93,
    "end": 92.170006
  },
  {
    "punctuated_word": "something",
    "start": 92.170006,
    "end": 92.41
  },
  {
    "punctuated_word": "of",
    "start": 92.41,
    "end": 92.57001
  },
  {
    "punctuated_word": "enduring",
    "start": 92.57001,
    "end": 92.97
  },
  {
    "punctuated_word": "value,",
    "start": 92.97,
    "end": 93.29
  },
  {
    "punctuated_word": "that's",
    "start": 93.29,
    "end": 93.79
  },
  {
    "punctuated_word": "I",
    "start": 94.33,
    "end": 94.41
  },
  {
    "punctuated_word": "think",
    "start": 94.41,
    "end": 94.425
  },
  {
    "punctuated_word": "that's",
    "start": 94.425,
    "end": 94.745
  },
  {
    "punctuated_word": "a",
    "start": 94.745,
    "end": 94.825005
  },
  {
    "punctuated_word": "good",
    "start": 94.825005,
    "end": 94.865005
  },
  {
    "punctuated_word": "thing",
    "start": 94.865005,
    "end": 94.90501
  },
  {
    "punctuated_word": "to",
    "start": 94.90501,
    "end": 95.145004
  },
  {
    "punctuated_word": "keep",
    "start": 95.145004,
    "end": 95.225006
  },
  {
    "punctuated_word": "in",
    "start": 95.225006,
    "end": 95.305
  },
  {
    "punctuated_word": "mind",
    "start": 95.305,
    "end": 95.465004
  },
  {
    "punctuated_word": "too.",
    "start": 95.465004,
    "end": 95.705
  },
  {
    "punctuated_word": "Yeah.",
    "start": 95.705,
    "end": 95.865005
  },
  {
    "punctuated_word": "Everyone",
    "start": 95.865005,
    "end": 96.185005
  },
  {
    "punctuated_word": "can",
    "start": 96.185005,
    "end": 96.345
  },
  {
    "punctuated_word": "build",
    "start": 96.345,
    "end": 96.58501
  },
  {
    "punctuated_word": "an",
    "start": 96.58501,
    "end": 96.745
  },
  {
    "punctuated_word": "absolutely",
    "start": 96.745,
    "end": 97.145004
  },
  {
    "punctuated_word": "incredible",
    "start": 97.145004,
    "end": 97.545006
  },
  {
    "punctuated_word": "demo",
    "start": 97.545006,
    "end": 97.785
  },
  {
    "punctuated_word": "right",
    "start": 97.785,
    "end": 98.025
  },
  {
    "punctuated_word": "now,",
    "start": 98.025,
    "end": 98.265
  },
  {
    "punctuated_word": "but",
    "start": 98.265,
    "end": 98.345
  },
  {
    "punctuated_word": "Everyone",
    "start": 98.425,
    "end": 98.745
  },
  {
    "punctuated_word": "can",
    "start": 98.745,
    "end": 98.90501
  },
  {
    "punctuated_word": "build",
    "start": 98.90501,
    "end": 98.985
  },
  {
    "punctuated_word": "an",
    "start": 98.985,
    "end": 99.225006
  },
  {
    "punctuated_word": "incredible",
    "start": 99.225006,
    "end": 99.545006
  },
  {
    "punctuated_word": "demo.",
    "start": 99.545006,
    "end": 99.865005
  },
  {
    "punctuated_word": "But",
    "start": 99.865005,
    "end": 100.025
  },
  {
    "punctuated_word": "building",
    "start": 100.025,
    "end": 100.425
  },
  {
    "punctuated_word": "a",
    "start": 100.425,
    "end": 100.58501
  },
  {
    "punctuated_word": "business,",
    "start": 100.58501,
    "end": 101.08501
  },
  {
    "punctuated_word": "man,",
    "start": 101.705,
    "end": 102.185005
  },
  {
    "punctuated_word": "that's",
    "start": 102.185005,
    "end": 102.425
  },
  {
    "punctuated_word": "the",
    "start": 102.425,
    "end": 102.58501
  },
  {
    "punctuated_word": "brass",
    "start": 102.58501,
    "end": 102.825005
  },
  {
    "punctuated_word": "rim.",
    "start": 102.825005,
    "end": 103.065
  },
  {
    "punctuated_word": "The",
    "start": 103.065,
    "end": 103.145004
  },
  {
    "punctuated_word": "rules",
    "start": 103.145004,
    "end": 103.465004
  },
  {
    "punctuated_word": "still",
    "start": 103.465004,
    "end": 103.705
  },
  {
    "punctuated_word": "apply.",
    "start": 103.705,
    "end": 104.185005
  },
  {
    "punctuated_word": "You",
    "start": 104.185005,
    "end": 104.345
  },
  {
    "punctuated_word": "can",
    "start": 104.345,
    "end": 104.505005
  },
  {
    "punctuated_word": "do",
    "start": 104.505005,
    "end": 104.665
  },
  {
    "punctuated_word": "it",
    "start": 104.665,
    "end": 104.825005
  },
  {
    "punctuated_word": "faster",
    "start": 104.825005,
    "end": 105.065
  },
  {
    "punctuated_word": "than",
    "start": 105.065,
    "end": 105.225006
  },
  {
    "punctuated_word": "ever",
    "start": 105.225006,
    "end": 105.385
  },
  {
    "punctuated_word": "before",
    "start": 105.385,
    "end": 105.625
  },
  {
    "punctuated_word": "and",
    "start": 105.625,
    "end": 105.785
  },
  {
    "punctuated_word": "better",
    "start": 105.785,
    "end": 106.025
  },
  {
    "punctuated_word": "than",
    "start": 106.025,
    "end": 106.185005
  },
  {
    "punctuated_word": "ever",
    "start": 106.185005,
    "end": 106.345
  },
  {
    "punctuated_word": "before,",
    "start": 106.345,
    "end": 106.58501
  },
  {
    "punctuated_word": "but",
    "start": 106.58501,
    "end": 106.825005
  },
  {
    "punctuated_word": "you",
    "start": 106.825005,
    "end": 106.905
  },
  {
    "punctuated_word": "still",
    "start": 106.905,
    "end": 107.065
  },
  {
    "punctuated_word": "have",
    "start": 107.065,
    "end": 107.225006
  },
  {
    "punctuated_word": "to",
    "start": 107.225006,
    "end": 107.305
  },
  {
    "punctuated_word": "build",
    "start": 107.305,
    "end": 107.465004
  },
  {
    "punctuated_word": "a",
    "start": 107.465004,
    "end": 107.545006
  },
  {
    "punctuated_word": "business.",
    "start": 107.545006,
    "end": 107.996
  }
];

  const duration = words[words.length-1].end + 0.5;
  const textContainer = createRef<Layout>();

  yield view.add(
    <Layout
      size={"100%"}
      ref={textContainer}
    />
  );

  yield* displayWords(textContainer, words, textSettings);
});

function* displayWords(container: Reference<Layout>, words: Word[], settings: CaptionSettings){
  let waitBefore = words[0].start;

  for (let i = 0; i < words.length; i += settings.numSimultaneousWords) {
    const currentBatch = words.slice(i, i + settings.numSimultaneousWords);
    const nextClipStart =
      i < words.length - 1 ? words[i + settings.numSimultaneousWords]?.start || null : null;
    const isLastClip = i + settings.numSimultaneousWords >= words.length;
    const waitAfter = isLastClip ? 1 : 0;
    const textRef = createRef<Txt>();
    yield* waitFor(waitBefore);

    if(settings.stream){
      let nextWordStart = 0;
      yield container().add(<Txt width={`${settings.textBoxWidthInPercent}%`} textWrap={true} zIndex={2} textAlign={settings.textAlign} ref={textRef}/>);

      for(let j = 0; j < currentBatch.length; j++){
        const word = currentBatch[j];
        yield* waitFor(nextWordStart);
        const optionalSpace = j === currentBatch.length-1? "" : " ";
        const backgroundRef = createRef<Rect>();
        const wordRef = createRef<Txt>();
        const opacitySignal = createSignal(settings.fadeInAnimation ? 0.5 : 1);
        textRef().add(
          <Txt
            fontSize={settings.fontSize}
            fontWeight={settings.fontWeight}
            fontFamily={settings.fontFamily}
            textWrap={false}
            textAlign={settings.textAlign}
            fill={settings.currentWordColor}
            ref={wordRef}
            lineWidth={settings.borderWidth}
            shadowBlur={settings.shadowBlur}
            shadowColor={settings.shadowColor}
            zIndex={2}
            stroke={settings.borderColor}
            opacity={opacitySignal}
          >
            {word.punctuated_word}
          </Txt>
        );
        textRef().add(<Txt fontSize={settings.fontSize}>{optionalSpace}</Txt>);
        container().add(<Rect fill={settings.currentWordBackgroundColor} zIndex={1} size={wordRef().size} position={wordRef().position} radius={10} padding={10} ref={backgroundRef} />);
        yield* all(waitFor(word.end-word.start), opacitySignal(1, Math.min((word.end-word.start)*0.5, 0.1)));
        wordRef().fill(settings.textColor);
        backgroundRef().remove();
        nextWordStart = currentBatch[j+1]?.start - word.end || 0;
      }
      textRef().remove();

    } else {
      yield container().add(<Txt width={`${settings.textBoxWidthInPercent}%`} textAlign={settings.textAlign} ref={textRef} textWrap={false} zIndex={2}/>);

      const wordRefs = [];
      const opacitySignal = createSignal(settings.fadeInAnimation ? 0.5 : 1);
      for(let j = 0; j < currentBatch.length; j++){
        const word = currentBatch[j];
        const optionalSpace = j === currentBatch.length-1? "" : " ";
        const wordRef = createRef<Txt>();
        textRef().add(
          <Txt
            fontSize={settings.fontSize}
            fontWeight={settings.fontWeight}
            ref={wordRef}
            fontFamily={settings.fontFamily}
            textWrap={false}
            textAlign={settings.textAlign}
            fill={settings.textColor}
            zIndex={2}
            stroke={settings.borderColor}
            lineWidth={settings.borderWidth}
            shadowBlur={settings.shadowBlur}
            shadowColor={settings.shadowColor}
            opacity={opacitySignal}
          >
            {word.punctuated_word}
          </Txt>
        );
        textRef().add(<Txt fontSize={settings.fontSize}>{optionalSpace}</Txt>);

        // we have to yield once to await the first word being aligned correctly
        if(j===0 && i === 0){
          yield;
        }
        wordRefs.push(wordRef);
      }

      yield* all(
        opacitySignal(1, Math.min(0.1, (currentBatch[0].end-currentBatch[0].start)*0.5)),
        highlightCurrentWord(container, currentBatch, wordRefs, settings.currentWordColor, settings.currentWordBackgroundColor),
        waitFor(currentBatch[currentBatch.length-1].end - currentBatch[0].start + waitAfter),
      );
      textRef().remove();
    }
    waitBefore = nextClipStart !== null ? nextClipStart - currentBatch[currentBatch.length-1].end : 0;
  }
}

function* highlightCurrentWord(container: Reference<Layout>, currentBatch: Word[], wordRefs: Reference<Txt>[], wordColor: string, backgroundColor: string){
  let nextWordStart = 0;

  for(let i = 0; i < currentBatch.length; i++){
    yield* waitFor(nextWordStart);
    const word = currentBatch[i];
    const originalColor = wordRefs[i]().fill();
    nextWordStart = currentBatch[i+1]?.start - word.end || 0;
    wordRefs[i]().text(wordRefs[i]().text());
    wordRefs[i]().fill(wordColor);

    const backgroundRef = createRef<Rect>();
    if(backgroundColor){
      container().add(<Rect fill={backgroundColor} zIndex={1} size={wordRefs[i]().size} position={wordRefs[i]().position} radius={10} padding={10} ref={backgroundRef} />);
    }

    yield* waitFor(word.end-word.start);
    wordRefs[i]().text(wordRefs[i]().text());
    wordRefs[i]().fill(originalColor);

    if(backgroundColor){
      backgroundRef().remove();
    }
  }
}
