import {makeScene2D} from '@revideo/2d';
import {Audio, Video, Txt, Layout, Rect} from '@revideo/2d/lib/components';
import {createRef, Reference} from '@revideo/core/lib/utils';
import {all, sequence, waitFor} from '@revideo/core/lib/flow';
import {slideTransition} from '@revideo/core/lib/transitions';
import {Direction} from '@revideo/core/lib/types';
import {createSignal} from '@revideo/core/lib/signals';

export default makeScene2D(function* (view) {
  // Layout setup for split screen
  const layout = createRef<Layout>();
  const mainVideo = createRef<Video>();
  const backgroundVideo = createRef<Video>();
  const mainVideoRect = createRef<Rect>();
  const backgroundVideoRect = createRef<Rect>();
  const subtitleText = createRef<Txt>();
  const subtitleContainer = createRef<Layout>();

  // Create signals for dynamic content
  const currentText = createSignal('');
  const currentWordIndex = createSignal(0);

  view.add(
    <Layout ref={layout} size={[1080, 1920]} layout>
      {/* Main Video (Top half) */}
      <Rect 
        ref={mainVideoRect}
        width={1080} 
        height={960} 
        y={-480}
        clip
        radius={20}
        stroke={'#333'}
        lineWidth={4}
      >
        <Video
          ref={mainVideo}
          src={'/home/runner/workspace/uploads/aad20974c6e24ba7f69c7e67e8024eea'}
          size={[1080, 960]}
          play={true}
        />
      </Rect>

      {/* Background Video (Bottom half) */}
      <Rect 
        ref={backgroundVideoRect}
        width={1080} 
        height={960} 
        y={480}
        clip
        radius={20}
        stroke={'#333'}
        lineWidth={4}
      >
        <Video
          ref={backgroundVideo}
          src={'/home/runner/workspace/uploads/80469bd5166dac1d3f124b345e80eed3'}
          size={[1080, 960]}
          play={true}
        />
      </Rect>

      {/* Subtitle Container - positioned at bottom for 9:16 format */}
      <Layout 
        ref={subtitleContainer}
        y={800}
        layout
        direction={'column'}
        alignItems={'center'}
        gap={20}
      >
        <Txt
          ref={subtitleText}
          text={currentText}
          fontSize={64}
          fontWeight={800}
          fill={'#00FF00'}
          fontFamily={'Courier New'}
          textAlign={'center'}
          shadowColor={'#000000'}
          shadowBlur={25}
          shadowOffset={[0, 4]}
          cache
        />
      </Layout>

      {/* Audio Source */}
      <Audio
        src={'/home/runner/workspace/uploads/80469bd5166dac1d3f124b345e80eed3'}
        play={true}
        time={0}
      />
    </Layout>
  );

  // Initialize videos
  yield* all(
    mainVideo().play(),
    backgroundVideo().play(),
  );

  // Subtitle animation sequence
  
  // Start subtitle animations
  yield* sequence(0.1,
    
  // Segment 1: "Risha Pant on Stump Mic."
  yield* waitFor(0.24);
  currentText('Risha Pant on Stump Mic.');
  
  yield* subtitleText().opacity(0, 0);
  yield* subtitleText().opacity(1, 0.3);
  
    yield* waitFor(0);
    currentWordIndex(0);
    yield* highlightWord(subtitleText, ['Risha', 'Pant', 'on', 'Stump', 'Mic.'], 0, {
      currentWordColor: '#FFFF00',
      currentWordBackgroundColor: '#FF0000'
    });
    yield* waitFor(0.47999997000000005);
    currentWordIndex(1);
    yield* highlightWord(subtitleText, ['Risha', 'Pant', 'on', 'Stump', 'Mic.'], 1, {
      currentWordColor: '#FFFF00',
      currentWordBackgroundColor: '#FF0000'
    });
    yield* waitFor(0.72);
    currentWordIndex(2);
    yield* highlightWord(subtitleText, ['Risha', 'Pant', 'on', 'Stump', 'Mic.'], 2, {
      currentWordColor: '#FFFF00',
      currentWordBackgroundColor: '#FF0000'
    });
    yield* waitFor(1.12);
    currentWordIndex(3);
    yield* highlightWord(subtitleText, ['Risha', 'Pant', 'on', 'Stump', 'Mic.'], 3, {
      currentWordColor: '#FFFF00',
      currentWordBackgroundColor: '#FF0000'
    });
    yield* waitFor(1.52);
    currentWordIndex(4);
    yield* highlightWord(subtitleText, ['Risha', 'Pant', 'on', 'Stump', 'Mic.'], 4, {
      currentWordColor: '#FFFF00',
      currentWordBackgroundColor: '#FF0000'
    });
  yield* waitFor(2.0199999999999996);
  yield* subtitleText().opacity(0, 0.3);,
    
  // Segment 2: "It is a show."
  yield* waitFor(2.6399999);
  currentText('It is a show.');
  
  yield* subtitleText().opacity(0, 0);
  yield* subtitleText().opacity(1, 0.3);
  
    yield* waitFor(0);
    currentWordIndex(0);
    yield* highlightWord(subtitleText, ['It', 'is', 'a', 'show.'], 0, {
      currentWordColor: '#FFFF00',
      currentWordBackgroundColor: '#FF0000'
    });
    yield* waitFor(0.16000009999999998);
    currentWordIndex(1);
    yield* highlightWord(subtitleText, ['It', 'is', 'a', 'show.'], 1, {
      currentWordColor: '#FFFF00',
      currentWordBackgroundColor: '#FF0000'
    });
    yield* waitFor(0.3200001000000001);
    currentWordIndex(2);
    yield* highlightWord(subtitleText, ['It', 'is', 'a', 'show.'], 2, {
      currentWordColor: '#FFFF00',
      currentWordBackgroundColor: '#FF0000'
    });
    yield* waitFor(0.48000010000000026);
    currentWordIndex(3);
    yield* highlightWord(subtitleText, ['It', 'is', 'a', 'show.'], 3, {
      currentWordColor: '#FFFF00',
      currentWordBackgroundColor: '#FF0000'
    });
  yield* waitFor(0.9800001000000003);
  yield* subtitleText().opacity(0, 0.3);
  );

  // Wait for video duration
  yield* waitFor(30); // Default 30 seconds, adjust based on actual video duration
});

// Helper function to create word highlighting
function* highlightWord(
  textRef: Reference<Txt>,
  words: string[],
  currentIndex: number,
  style: any
) {
  const highlightedText = words.map((word, index) => {
    if (index === currentIndex) {
      return `<span style="color: #FFFF00; background-color: #FF0000; padding: 4px 8px; border-radius: 4px;">${word}</span>`;
    }
    return word;
  }).join(' ');

  textRef().text(highlightedText);
}
