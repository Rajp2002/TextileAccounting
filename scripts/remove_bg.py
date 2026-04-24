from PIL import Image

input_path = "public/images/WeavlyLogo.png"
output_path = "public/images/WeavlyLogo.png"

img = Image.open(input_path).convert("RGBA")
pixels = img.load()
width, height = img.size

# Sample the background color from the top-left corner
bg_color = pixels[0, 0][:3]
print(f"Detected background color: RGB{bg_color}")

tolerance = 45

def color_distance(c1, c2):
    return ((c1[0]-c2[0])**2 + (c1[1]-c2[1])**2 + (c1[2]-c2[2])**2) ** 0.5

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        
        # Is it close to the background color?
        dist_to_bg = color_distance((r, g, b), bg_color)
        
        # Is it strongly orange? (protect the logo)
        is_orange = r > 160 and g < 150 and b < 100
        
        if dist_to_bg < tolerance and not is_orange:
            pixels[x, y] = (0, 0, 0, 0)  # Make transparent

img.save(output_path, "PNG")
print(f"Done — saved transparent PNG to {output_path}")
