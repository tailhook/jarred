#ifndef _H_BUFFER
#define _H_BUFFER

#include <stddef.h>

typedef struct buffer_s {
    char *data;
    size_t size;
    size_t capacity;
} buffer_t;

int buffer_init(buffer_t *buffer, size_t nbytes);
void buffer_free(buffer_t *buffer);
int buffer_printf(buffer_t *buf, char *format, ...);

#endif //_H_BUFFER
