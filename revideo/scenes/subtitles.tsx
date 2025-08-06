import {Rect, Txt, Video, makeScene2D} from '@revideo/2d';
import {all, chain, createRef, useScene, waitFor} from '@revideo/core';

export default makeScene2D('subtitles', function* (view) {
  const scene = useScene();
  
  // Get variables
  const primaryVideo = scene.variables.get('primaryVideo', '');
  const subtitleTextContent = scene.variables.get('subtitleTextContent', 'Welcome to AI Video Editor');
  const subtitleFontSize = scene.variables.get('subtitleFontSize', 48);
  const subtitleColor = scene.variables.get('subtitleColor', '#FFFFFF');
  const subtitleBackgroundColor = scene.variables.get('subtitleBackgroundColor', 'rgba(0,0,0,0.8)');
  
  const videoRef = createRef<Video>();
  const subtitleBgRef = createRef<Rect>();
  const subtitleTextRef = createRef<Txt>();
  
  // Add background video
  yield view.add(
    <Video
      ref={videoRef}
      src={primaryVideo}
      size={['100%', '100%']}
      play={true}
    />
  );

  // Add subtitle background
  yield view.add(
    <Rect
      ref={subtitleBgRef}
      width={0}
      height={80}
      fill={subtitleBackgroundColor}
      radius={12}
      y={400}
      opacity={0}
    />
  );

  // Add subtitle text
  yield view.add(
    <Txt
      ref={subtitleTextRef}
      text=""
      fontSize={subtitleFontSize}
      fill={subtitleColor}
      fontWeight={600}
      y={400}
      opacity={0}
    />
  );

  yield* waitFor(1);

  // Animate subtitle entrance
  yield* chain(
    all(
      subtitleBgRef().width(subtitleTextContent.length * 25, 0.5),
      subtitleBgRef().opacity(0.9, 0.5)
    ),
    subtitleTextRef().opacity(1, 0.3)
  );

  // Typewriter effect for subtitle
  const words = scene.variables.get('subtitleTextContent', 'Welcome to AI Video Editor').split(' ');
  for (let i = 0; i < words.length; i++) {
    const currentText = words.slice(0, i + 1).join(' ');
    yield* subtitleTextRef().text(currentText, 0.1);
    yield* waitFor(0.3);
  }

  // Highlight effect
  yield* all(
    subtitleTextRef().scale(1.05, 0.2),
    subtitleTextRef().scale(1, 0.2)
  );

  yield* waitFor(2);

  // Fade out subtitle
  yield* all(
    subtitleBgRef().opacity(0, 0.5),
    subtitleTextRef().opacity(0, 0.5)
  );

  yield* waitFor(1);
});