<template>
  <div class="container">
    <h1>Hello Bun + Vue SFC!</h1>
    <p>Count: {{ count }}</p>
    <button @click="increment">+1</button>
    <p class="tip">修改 count 后，HMR 会自动更新！</p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const count = ref(0);

const increment = () => {
  count.value++;
};
</script>

<style scoped>
.container {
  padding: 2rem;
  text-align: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  max-width: 400px;
  margin: 2rem auto;
}

h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
}

button {
  background: #42b983;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

button:hover {
  background: #3aa876;
}

.tip {
  font-size: 0.9rem;
  opacity: 0.8;
  margin-top: 1rem;
  font-style: italic;
}
</style>