import React from 'react';
import { registerRoot, Composition } from 'remotion';
import { Clip } from './Clip.jsx';

// Same settings for every clip: only durationInFrames (and the frame/audio files) change per render.
const Root = () => (
  <Composition
    id="Clip"
    component={Clip}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={90}
    defaultProps={{ frames: 90, audio: null }}
    calculateMetadata={({ props }) => ({ durationInFrames: props.frames })}
  />
);
registerRoot(Root);
