import {Code, Img, Rect, Txt, Video, makeScene2D} from '@revideo/2d';
import {all, chain, createRef, slideTransition, useScene, waitFor} from '@revideo/core';
import {Direction} from '@revideo/core';

export default makeScene2D('videoEditing', function* (view) {
  const scene = useScene();
  
  // Get variables
  const primaryVideo = scene.variables.get('primaryVideo', '');
  const titleText = scene.variables.get('titleText', 'Video Editing Scene');
  const primaryColor = scene.variables.get('primaryColor', '#8B5CF6');
  const secondaryColor = scene.variables.get('secondaryColor', '#06B6D4');
  
  const videoRef = createRef<Video>();
  const titleRef = createRef<Txt>();
  const codeRef = createRef<Code>();
  
  // Slide transition from left
  yield* slideTransition(Direction.Right);

  // Add main video with mask
  yield view.add(
    <Video
      ref={videoRef}
      src={primaryVideo}
      size={[1200, 675]}
      radius={20}
      play={true}
      x={-600}
      opacity={0}
    />
  );

  // Add title text
  yield view.add(
    <Txt
      ref={titleRef}
      text={titleText}
      fontSize={64}
      fill={primaryColor}
      fontWeight={700}
      x={400}
      y={-300}
      opacity={0}
    />
  );

  // Add code snippet showcase
  yield view.add(
    <Code
      ref={codeRef}
      language="typescript"
      fontSize={24}
      code={`// Create professional videos with code
import {Video, Txt} from '@revideo/2d';

export default makeScene2D('scene', function* (view) {
  yield view.add(
    <Video src="video.mp4" play={true} />
  );
});`}
      x={400}
      y={100}
      opacity={0}
    />
  );

  // Animate elements in sequence
  yield* chain(
    all(
      videoRef().x(0, 1).to(-300, 1),
      videoRef().opacity(1, 1)
    ),
    all(
      titleRef().opacity(1, 0.8),
      titleRef().y(-350, 0.8)
    ),
    all(
      codeRef().opacity(1, 1),
      codeRef().y(50, 1)
    )
  );

  yield* waitFor(3);

  // Scale video for emphasis
  yield* all(
    videoRef().scale(1.1, 0.5),
    videoRef().scale(1, 0.5)
  );

  yield* waitFor(2);
});