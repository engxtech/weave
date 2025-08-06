import {Audio, Img, Video, makeScene2D} from '@revideo/2d';
import {all, chain, createRef, waitFor, useScene} from '@revideo/core';

export default makeScene2D('example', function* (view) {
  const scene = useScene();
  const logoRef = createRef<Img>();
  
  // Get variables from project
  const primaryVideo = scene.variables.get('primaryVideo', '');
  const titleText = scene.variables.get('titleText', 'AI Video Editor');
  const primaryColor = scene.variables.get('primaryColor', '#8B5CF6');
  const outputDuration = scene.variables.get('outputDuration', 10);

  // Add background video
  yield view.add(
    <>
      <Video
        src={primaryVideo}
        size={['100%', '100%']}
        play={true}
        volume={0.8}
      />
      <Audio
        src={'https://revideo-example-assets.s3.amazonaws.com/chill-beat.mp3'}
        play={true}
        time={17.0}
        volume={0.3}
      />
    </>,
  );

  yield* waitFor(1);

  // Add logo with animation
  view.add(
    <Img
      width={'5%'}
      ref={logoRef}
      src={'/logo.svg'}
      fill={primaryColor}
    />,
  );

  // Animate logo entrance
  yield* chain(
    all(
      logoRef().scale(0).scale(1, 1.5),
      logoRef().rotation(0).rotation(360, 2)
    ),
    logoRef().scale(1.2, 0.5),
  );

  // Hold for remaining duration
  const remainingTime = Math.max(0, scene.variables.get('outputDuration', 10) - 4.5);
  yield* waitFor(remainingTime);
});