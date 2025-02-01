<video 
  className={styles.thumbnail}
  preload="metadata"
  muted
  poster={clip.thumbnailUrl}
  onLoadedMetadata={(e) => {
    // Set the current time to the first frame
    e.target.currentTime = 0;
  }}
  onMouseOver={e => {
    e.target.play().catch(() => {
      console.log('Autoplay prevented');
    });
  }}
  onMouseOut={e => {
    e.target.pause();
    e.target.currentTime = 0;
  }}
>
  <source src={clip.url} type="video/mp4" />
</video> 