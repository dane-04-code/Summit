import { Composition } from "remotion";
import { ReleaseVideo, durationInFrames } from "./ReleaseVideo";
import {
  PreviewReleaseVideo,
  previewDurationInFrames,
} from "./PreviewReleaseVideo";

export const ReleaseComposition = () => {
  return (
    <>
      <Composition
        id="SummitRelease"
        component={ReleaseVideo}
        durationInFrames={durationInFrames}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="SummitReleasePreview"
        component={PreviewReleaseVideo}
        durationInFrames={previewDurationInFrames}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};
