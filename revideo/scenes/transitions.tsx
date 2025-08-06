import {Circle, Rect, Video, makeScene2D} from '@revideo/2d';
import {all, chain, createRef, easeInOutCubic, useScene, waitFor} from '@revideo/core';

export default makeScene2D('transitions', function* (view) {
  const scene = useScene();
  
  // Get variables
  const primaryVideo = scene.variables.get('primaryVideo', '');
  const secondaryVideo = scene.variables.get('secondaryVideo', primaryVideo);
  const transitionDurationValue = scene.variables.get('transitionDuration', 1.0) as number;
  const primaryColor = scene.variables.get('primaryColor', '#8B5CF6');
  
  const video1Ref = createRef<Video>();
  const video2Ref = createRef<Video>();
  const transitionRef = createRef<Circle>();
  const overlayRef = createRef<Rect>();
  
  // Add first video
  yield view.add(
    <Video
      ref={video1Ref}
      src={primaryVideo}
      size={['100%', '100%']}
      play={true}
    />
  );

  // Add second video (initially hidden)
  yield view.add(
    <Video
      ref={video2Ref}
      src={secondaryVideo}
      size={['100%', '100%']}
      play={true}
      opacity={0}
    />
  );

  // Add transition circle
  yield view.add(
    <Circle
      ref={transitionRef}
      size={0}
      fill={primaryColor}
      zIndex={10}
    />
  );

  // Add overlay for effects
  yield view.add(
    <Rect
      ref={overlayRef}
      size={['100%', '100%']}
      fill={primaryColor}
      opacity={0}
      zIndex={5}
    />
  );

  yield* waitFor(2);

  // Circle wipe transition
  yield* chain(
    // Expand circle to cover screen
    transitionRef().size([3000, 3000], transitionDurationValue, easeInOutCubic),
    
    // Switch videos and contract circle
    all(
      video1Ref().opacity(0, 0.1),
      video2Ref().opacity(1, 0.1),
      transitionRef().size(0, transitionDurationValue, easeInOutCubic)
    )
  );

  yield* waitFor(2);

  // Flash transition effect
  yield* chain(
    overlayRef().opacity(0.8, 0.1),
    all(
      overlayRef().opacity(0, 0.3),
      video2Ref().scale(1.1, 0.3),
      video2Ref().scale(1, 0.3)
    )
  );

  yield* waitFor(1);
});