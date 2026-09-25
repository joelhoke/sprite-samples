"""Feather alpha inward, retaining the source RGB and avoiding background-colour halos."""
import numpy as np
from PIL import Image
from scipy.ndimage import distance_transform_edt


def feather_inward(image: Image.Image, width: float = 3.0) -> Image.Image:
    alpha=np.array(image.getchannel('A'),dtype=np.float32)
    distance=distance_transform_edt(np.pad(alpha>16,1))[1:-1,1:-1]
    t=np.clip((distance-.25)/width,0,1)
    weight=t*t*(3-2*t)
    result=image.copy()
    result.putalpha(Image.fromarray(np.round(alpha*weight).astype('uint8')))
    return result
