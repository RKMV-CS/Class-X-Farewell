import React from 'react';
import { AbsoluteFill, Audio, Img, staticFile, useCurrentFrame } from 'remotion';

// public dir = frames/<clip>/ : 00001.jpg ... and optional audio file name in props.audio
export const Clip = ({ frames, audio }) => {
  const n = Math.min(useCurrentFrame() + 1, frames);
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Img src={staticFile(String(n).padStart(5, '0') + '.png')} style={{ width: 1920, height: 1080 }} />
      {audio ? <Audio src={staticFile(audio)} /> : null}
    </AbsoluteFill>
  );
};
