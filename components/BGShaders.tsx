export const bgFragShader = `

uniform vec3 u_colorA;
uniform vec3 u_colorB;
uniform vec3 u_colorC;
uniform vec3 u_colorD;
uniform float u_time;
varying float vDisplacement;
varying vec2 vUv;

vec3 grad(vec2 uv, float t){
  float mid = 0.5;
  float x_rot = cos(t) * (uv.x - mid) + sin(t) * (uv.y - mid) + mid;
  return mix(u_colorA, u_colorB, x_rot);
}

vec3 grad2(vec2 uv, float t){
  float mid = 0.5;
  float x_rot = cos(t) * (uv.x - mid) + sin(t) * (uv.y - mid) + mid;
  return mix(u_colorC, u_colorD, x_rot);
}

void main() {
  float interval = 20.0;
  float steps = 3.0;
  float width = 1.0;
  float subWidth = 2.0;

  float mainEdge = abs(fract(vDisplacement*interval) - 0.5);
  float mainThick = fwidth(vDisplacement * interval);
  float mainMinBorder = max(0.0, width-1.0);
  float mainMaxBorder = max(1.0, width);
  float mainBorderSize = mainMaxBorder-mainMinBorder;
  // - (mainThick*mainMinBorder))/(mainThick*(mainBorderSize)),
  float mainColor = clamp(
    (mainEdge*2.0),
    0.0,
    1.0
  );
  
  float subEdge = abs(fract(vDisplacement*interval*steps) -0.5);
  float subThick = fwidth(vDisplacement *interval*steps);
  float subMinBorder = max(0.0, subWidth-1.0);
  float subMaxBorder = max(1.0, subWidth);
  float subBorderSize =subMaxBorder-subMinBorder;
  float subColor = clamp(
    (subEdge - (subThick*subMinBorder))/(subThick*(subBorderSize)),
    0.0,
    1.0
  );

  float invertBoth = (1.0-subColor)*0.75 + (1.0-mainColor)*0.25;
  float finalColor = clamp(invertBoth, 0.0, 1.0) ;
  
  gl_FragColor = vec4(grad(vUv, u_time*0.5)*finalColor + grad2(vUv, -u_time*0.1)*(1.0-finalColor), 1.0);  
  
}

`

export const bgVertShader = `

uniform float u_time;
uniform float u_timeScale;
uniform float u_noiseScale;
uniform float u_middleParting;

varying vec2 vUv;
varying float vDisplacement;

//https://github.com/yiwenl/glsl-fbm/blob/master/3d.glsl
#define NUM_OCTAVES 3

float mod289(float x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 mod289(vec4 x){return x - floor(x * (1.0 / 289.0)) * 289.0;}
vec4 perm(vec4 x){return mod289(((x * 34.0) + 1.0) * x);}

float noise(vec3 p){
    vec3 a = floor(p);
    vec3 d = p - a;
    d = d * d * (3.0 - 2.0 * d);

    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);
    vec4 k1 = perm(b.xyxy);
    vec4 k2 = perm(k1.xyxy + b.zzww);

    vec4 c = k2 + a.zzzz;
    vec4 k3 = perm(c);
    vec4 k4 = perm(c + 1.0);

    vec4 o1 = fract(k3 * (1.0 / 41.0));
    vec4 o2 = fract(k4 * (1.0 / 41.0));

    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);
    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);

    return o4.y * d.y + o4.x * (1.0 - d.y);
}


float fbm(vec3 x) {
	float v = 0.0;
	float a = 0.5;
	vec3 shift = vec3(100);
	for (int i = 0; i < NUM_OCTAVES; ++i) {
		v += a * noise(x);
		x = x * 2.0 + shift;
		a *= 0.5;
	}
	return v;
}
//end fbm

void main() {
  vec4 modelPosition = modelMatrix * vec4(position, 1.0);

  float timeScale = u_time * u_timeScale;
  vec3 noisyBoi = vec3(modelPosition.x * u_noiseScale, modelPosition.y * u_noiseScale, timeScale);


  float scale = max(
    mix(0.02, 
      -0.15*cos(timeScale*5.0) + 0.25, 
      min(timeScale*1.25, 1.0))
    , 0.0);

  float noise = fbm(noisyBoi);
  
  float offset = scale*noise;

  //flatten the closer to modelPosition.x is to 0

  offset *= min(1.0, abs(modelPosition.x*0.0005) + u_middleParting);
    
  modelPosition.y += offset*0.5;

  //this is for if we ever do 3d -> //vec3 newPos = vec3(position.x, position.y+vDisplacement, position.z); //= position + normal * (vDisplacement*3.0);

  //set varyings and final pos
  vDisplacement = offset;
  vec4 viewPosition = viewMatrix * modelPosition;
  vec4 projectedPosition = projectionMatrix * viewPosition;
  vUv = uv;

  gl_Position = projectedPosition;
}
`
